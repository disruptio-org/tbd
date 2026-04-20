import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { openai } from '@/lib/openai';
import { buildOrchestratorSystemPrompt, buildOrchestratorUserMessage } from '@/lib/boardroom/prompts';

/**
 * POST /api/boardroom/command — Executive command endpoint (V2)
 * Body: { command: string, projectId?: string }
 *
 * Company DNA analyzes the command. Now uses per-member skills via BrainProfileSkill.
 * Saves result as a PlanDraft for interactive editing before approval.
 */
export async function POST(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { command, projectId, clarificationAnswers } = body;

        if (!command?.trim()) {
            return NextResponse.json({ error: 'command is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        // 1. Gather company context
        let companyContext = '';

        const { data: company } = await db
            .from('Company')
            .select('name, email, website, webContext, language')
            .eq('id', companyId)
            .maybeSingle();

        if (company) {
            companyContext += `Company: ${company.name}\n`;
            if (company.website) companyContext += `Website: ${company.website}\n`;
            if (company.webContext) companyContext += `About: ${company.webContext}\n`;
        }

        const { data: dna } = await db
            .from('CompanyDNA')
            .select('missionVision, productsServices, targetAudience, tonePersonality')
            .eq('companyId', companyId)
            .maybeSingle();

        if (dna) {
            if (dna.missionVision) companyContext += `\nMission/Vision: ${dna.missionVision}`;
            if (dna.productsServices) companyContext += `\nProducts/Services: ${dna.productsServices}`;
            if (dna.targetAudience) companyContext += `\nTarget Audience: ${dna.targetAudience}`;
            if (dna.tonePersonality) companyContext += `\nTone: ${dna.tonePersonality}`;
        }

        // Project + Customer context
        let projectContext: string | null = null;
        if (projectId) {
            const { data: project } = await db
                .from('Project')
                .select('name, description, contextText, customerId')
                .eq('id', projectId)
                .eq('companyId', companyId)
                .maybeSingle();

            if (project) {
                projectContext = `Project: ${project.name}`;
                if (project.description) projectContext += `\nDescription: ${project.description}`;
                if (project.contextText) projectContext += `\nContext: ${project.contextText}`;

                // Enrich with customer data
                if (project.customerId) {
                    const { data: customer } = await db
                        .from('Customer')
                        .select('name, email, industry, notes')
                        .eq('id', project.customerId)
                        .maybeSingle();
                    if (customer) {
                        projectContext += `\nCustomer: ${customer.name}`;
                        if (customer.industry) projectContext += ` (${customer.industry})`;
                        if (customer.notes) projectContext += `\nCustomer Notes: ${customer.notes}`;
                    }
                }
            }
        }

        // Knowledge Nodes (structured company knowledge)
        try {
            const knQuery = db
                .from('KnowledgeNode')
                .select('type, title, summary')
                .eq('companyId', companyId)
                .eq('status', 'active')
                .limit(20);

            // Prefer project-scoped nodes if project is set
            if (projectId) {
                knQuery.or(`projectId.eq.${projectId},projectId.is.null`);
            }

            const { data: knowledgeNodes } = await knQuery;
            if (knowledgeNodes && knowledgeNodes.length > 0) {
                companyContext += '\n\nCOMPANY KNOWLEDGE:\n';
                for (const node of knowledgeNodes) {
                    companyContext += `[${(node.type || 'general').toUpperCase()}] ${node.title}\n`;
                    if (node.summary) companyContext += `${node.summary}\n\n`;
                }
            }
        } catch (knErr) {
            console.error('[boardroom/command] KnowledgeNode query failed (non-critical):', knErr);
        }

        // 2. Get members with per-member skills via BrainProfileSkill
        const { data: brains } = await db
            .from('AIBrainProfile')
            .select('id, name, brainType, description')
            .eq('companyId', companyId)
            .eq('isEnabled', true);

        const teamMembers = [];
        for (const brain of (brains || [])) {
            const { data: skillLinks } = await db
                .from('BrainProfileSkill')
                .select('skillId')
                .eq('brainProfileId', brain.id);

            let skills: { id: string; key: string; name: string; description?: string }[] = [];
            if (skillLinks && skillLinks.length > 0) {
                const { data: skillRecords } = await db
                    .from('AssistantSkill')
                    .select('id, key, name, description')
                    .in('id', skillLinks.map(s => s.skillId))
                    .eq('status', 'ACTIVE');
                skills = (skillRecords || []).map(s => ({ ...s, description: s.description || undefined }));
            }

            teamMembers.push({
                id: brain.id,
                name: brain.name,
                brainType: brain.brainType,
                description: brain.description || undefined,
                skills,
            });
        }

        // 3. Wiki context
        let wikiContext = '';
        try {
            const { retrieveWikiContext } = await import('@/lib/wiki/retriever');
            const wikiResult = await retrieveWikiContext(companyId, command.trim(), { maxPages: 8, projectId: projectId || undefined });
            wikiContext = wikiResult.formattedContext;
        } catch (wikiErr) {
            console.error('[boardroom/command] Wiki retrieval failed (non-critical):', wikiErr);
        }

        // 4. Call OpenAI for plan generation
        const systemPrompt = buildOrchestratorSystemPrompt(companyContext, teamMembers, wikiContext);
        const userMessage = buildOrchestratorUserMessage(command.trim(), projectContext, clarificationAnswers);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.4,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) {
            return NextResponse.json({ error: 'Empty AI response' }, { status: 500 });
        }

        let plan;
        try {
            plan = JSON.parse(raw);
        } catch {
            console.error('[boardroom/command] Failed to parse AI response:', raw);
            return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
        }

        // 5. Save as PlanDraft
        const now = new Date().toISOString();
        const draftId = crypto.randomUUID();
        const draft = {
            id: draftId,
            companyId,
            projectId: projectId || null,
            command: command.trim(),
            title: plan.title || plan.objective?.slice(0, 100) || 'Untitled Plan',
            objective: plan.objective || command.trim(),
            successCriteria: plan.successCriteria || null,
            businessGoal: plan.businessGoal || null,
            requestedOutcome: plan.requestedOutcome || null,
            workType: plan.workType || null,
            confidenceScore: plan.confidenceScore ?? null,
            planSummary: plan.planSummary || null,
            workstreams: plan.workstreams || [],
            tasks: plan.tasks || [],
            approvalGates: plan.approvalGates || [],
            executionMode: plan.recommendedExecutionMode || 'MANUAL',
            status: 'IN_REVIEW',
            version: 1,
            createdById: auth.dbUser.id,
            updatedAt: now,
        };

        await db.from('PlanDraft').insert(draft);

        // Save initial version snapshot
        await db.from('PlanDraftVersion').insert({
            id: crypto.randomUUID(),
            planDraftId: draftId,
            version: 1,
            snapshot: draft,
            changeNote: 'AI-generated plan from command',
        });

        return NextResponse.json({
            planDraftId: draftId,
            plan,
            command: command.trim(),
            projectId: projectId || null,
            teamMembers: teamMembers.map(m => ({ id: m.id, name: m.name, brainType: m.brainType, skillCount: m.skills.length })),
        });
    } catch (error) {
        console.error('[boardroom/command] Error:', error);
        return NextResponse.json({ error: 'Failed to process command' }, { status: 500 });
    }
}
