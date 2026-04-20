import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { openai } from '@/lib/openai';
import { buildOrchestratorSystemPrompt, buildOrchestratorUserMessage } from '@/lib/boardroom/prompts';

type RouteContext = { params: Promise<{ draftId: string }> };

/**
 * POST /api/boardroom/plan-drafts/[draftId]/regenerate
 * Re-runs the AI planner with optional user feedback, creates a new version.
 * Body: { feedback?: string }
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { draftId } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    const { data: draft } = await db
        .from('PlanDraft')
        .select('*')
        .eq('id', draftId)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status === 'APPROVED' || draft.status === 'DISCARDED') {
        return NextResponse.json({ error: 'Draft already finalized' }, { status: 400 });
    }

    const body = await req.json();
    const feedback = body.feedback?.trim() || '';

    // Gather context (same as command route)
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

    // Get members with per-member skills
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

    // Build prompt with feedback
    const command = draft.command || draft.objective;
    let userMessage = buildOrchestratorUserMessage(command);
    if (feedback) {
        userMessage += `\n\nUSER FEEDBACK ON PREVIOUS PLAN:\n${feedback}\n\nPlease regenerate the plan addressing this feedback.`;
    }
    if (draft.planSummary) {
        userMessage += `\n\nPREVIOUS PLAN SUMMARY:\n${draft.planSummary}`;
    }

    const systemPrompt = buildOrchestratorSystemPrompt(companyContext, teamMembers);

    try {
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
        if (!raw) return NextResponse.json({ error: 'Empty AI response' }, { status: 500 });

        let plan;
        try {
            plan = JSON.parse(raw);
        } catch {
            return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
        }

        const now = new Date().toISOString();
        const newVersion = draft.version + 1;

        // Update draft with new plan
        await db.from('PlanDraft').update({
            title: plan.title || draft.title,
            objective: plan.objective || draft.objective,
            successCriteria: plan.successCriteria || draft.successCriteria,
            businessGoal: plan.businessGoal || draft.businessGoal,
            requestedOutcome: plan.requestedOutcome || draft.requestedOutcome,
            workType: plan.workType || draft.workType,
            confidenceScore: plan.confidenceScore ?? draft.confidenceScore,
            planSummary: plan.planSummary || draft.planSummary,
            workstreams: plan.workstreams || [],
            tasks: plan.tasks || [],
            approvalGates: plan.approvalGates || [],
            executionMode: plan.recommendedExecutionMode || draft.executionMode,
            version: newVersion,
            status: 'IN_REVIEW',
            updatedAt: now,
        }).eq('id', draftId);

        // Save version snapshot
        const { data: updatedDraft } = await db.from('PlanDraft').select('*').eq('id', draftId).single();
        await db.from('PlanDraftVersion').insert({
            id: crypto.randomUUID(),
            planDraftId: draftId,
            version: newVersion,
            snapshot: updatedDraft,
            changeNote: feedback ? `AI re-planned: ${feedback.substring(0, 100)}` : 'AI regenerated plan',
        });

        return NextResponse.json({ draft: updatedDraft, version: newVersion });
    } catch (error) {
        console.error('[plan-drafts/regenerate] Error:', error);
        return NextResponse.json({ error: 'Failed to regenerate plan' }, { status: 500 });
    }
}
