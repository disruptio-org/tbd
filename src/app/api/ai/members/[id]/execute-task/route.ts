import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';
import { openai } from '@/lib/openai';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/ai/members/[id]/execute-task
 *
 * Executes a delegated board task in the background.
 * Accepts taskId + context, generates output via AI, updates the task
 * with progress steps and final result. Designed to be fire-and-forget
 * from the client side.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: memberId } = await ctx.params;
    const body = await req.json();
    const { taskId, extractedParams, docIds, skill } = body;

    if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const db = createAdminClient();
    const companyId = auth.companyId;
    const now = () => new Date().toISOString();

    // ─── Load task ────────────────────────────────────
    const { data: task } = await db
        .from('Task')
        .select('*')
        .eq('id', taskId)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // ─── Load brain profile ───────────────────────────
    const { data: brain } = await db
        .from('AIBrainProfile')
        .select('id, name, brainType, description, configJson, advancedInstructions')
        .eq('id', memberId)
        .maybeSingle();

    if (!brain) return NextResponse.json({ error: 'AI member not found' }, { status: 404 });

    // ─── Log progress: ANALYZING ──────────────────────
    await db.from('TaskActivity').insert({
        id: crypto.randomUUID(),
        taskId,
        actorId: auth.userId,
        action: 'ai_progress',
        metadata: { step: 'analyzing', label: 'Analyzing context', memberId, memberName: brain.name },
    });

    // ─── Load company context ─────────────────────────
    const { data: company } = await db
        .from('Company')
        .select('name, webContext')
        .eq('id', companyId)
        .maybeSingle();

    const { data: dna } = await db
        .from('CompanyDNA')
        .select('missionVision, productsServices, targetAudience, tonePersonality')
        .eq('companyId', companyId)
        .maybeSingle();

    // ─── Load document context ────────────────────────
    let documentContext = '';
    if (docIds && Array.isArray(docIds) && docIds.length > 0) {
        const { data: docs } = await db
            .from('Document')
            .select('id, filename, extractedText')
            .in('id', docIds.slice(0, 5));
        if (docs && docs.length > 0) {
            const docTexts = docs
                .filter(d => d.extractedText)
                .map(d => `--- ${d.filename} ---\n${d.extractedText!.substring(0, 3000)}`)
                .join('\n\n');
            if (docTexts) documentContext = `\n\nATTACHED DOCUMENTS:\n${docTexts}`;
        }
    }

    // ─── Load skill context ───────────────────────────
    let skillContext = '';
    if (skill) {
        const { data: skillData } = await db
            .from('AssistantSkill')
            .select('name, description, instructionPrompt, outputSchema')
            .eq('key', skill)
            .eq('assistantType', brain.brainType)
            .maybeSingle();
        if (skillData) {
            skillContext = `\nSELECTED SKILL: ${skillData.name}`;
            if (skillData.description) skillContext += `\nSKILL DESCRIPTION: ${skillData.description}`;
            if (skillData.instructionPrompt) skillContext += `\nSKILL INSTRUCTIONS:\n${skillData.instructionPrompt}`;
            if (skillData.outputSchema) skillContext += `\nEXPECTED OUTPUT FORMAT: ${JSON.stringify(skillData.outputSchema)}`;
        }
    }

    // ─── Log progress: GENERATING ─────────────────────
    await db.from('TaskActivity').insert({
        id: crypto.randomUUID(),
        taskId,
        actorId: auth.userId,
        action: 'ai_progress',
        metadata: { step: 'generating', label: 'Generating draft' },
    });

    // ─── Build prompt & execute ───────────────────────
    const params = extractedParams || {};
    const paramsSummary = Object.entries(params)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

    const systemPrompt = `You are ${brain.name}, an AI team member.

COMPANY: ${company?.name || 'Unknown'}
${company?.webContext ? `ABOUT: ${company.webContext}` : ''}
${dna?.missionVision ? `MISSION: ${dna.missionVision}` : ''}
${dna?.productsServices ? `PRODUCTS/SERVICES: ${dna.productsServices}` : ''}
${dna?.targetAudience ? `TARGET AUDIENCE: ${dna.targetAudience}` : ''}
${dna?.tonePersonality ? `TONE: ${dna.tonePersonality}` : ''}

YOUR ROLE: ${brain.name} (${brain.brainType.replace(/_/g, ' ')})
${brain.description ? `DESCRIPTION: ${brain.description}` : ''}
${brain.advancedInstructions ? `CUSTOM INSTRUCTIONS:\n${brain.advancedInstructions}` : ''}
${skillContext}

TASK: ${task.title}
${task.description ? `DESCRIPTION: ${task.description}` : ''}
${paramsSummary ? `\nPARAMETERS:\n${paramsSummary}` : ''}
${documentContext}

INSTRUCTIONS:
1. Execute this task thoroughly and produce actionable, professional output
2. Follow the skill instructions if provided
3. Be specific, detailed, and practical
4. Produce the best quality work you can
5. Do NOT ask follow-up questions — deliver the finished output

Respond with a JSON object:
{
  "output": "The detailed deliverable/output for this task (can be long, multi-paragraph, formatted in Markdown)",
  "summary": "A 1-2 sentence summary of what was produced",
  "title": "A title for the deliverable"
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Execute the task: "${task.title}"` },
            ],
            temperature: 0.5,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) {
            await db.from('TaskActivity').insert({
                id: crypto.randomUUID(),
                taskId,
                actorId: auth.userId,
                action: 'ai_progress',
                metadata: { step: 'error', label: 'Generation failed — empty response' },
            });
            return NextResponse.json({ error: 'Empty AI response' }, { status: 500 });
        }

        let result;
        try {
            result = JSON.parse(raw);
        } catch {
            result = { output: raw, summary: 'Task executed', title: task.title };
        }

        // ─── Log progress: REVIEWING ──────────────────
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId,
            actorId: auth.userId,
            action: 'ai_progress',
            metadata: { step: 'reviewing', label: 'Reviewing output' },
        });

        // ─── Log progress: FINALIZING ─────────────────
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId,
            actorId: auth.userId,
            action: 'ai_progress',
            metadata: { step: 'finalizing', label: 'Finalizing' },
        });

        // ─── Update the task with the generated output ─
        const outputBlock = [
            `## ${result.title || task.title}`,
            '',
            result.output || '',
            '',
            `---`,
            `*Generated by ${brain.name} • ${new Date().toLocaleString()}*`,
        ].join('\n');

        await db.from('Task').update({
            description: outputBlock,
            updatedAt: now(),
        }).eq('id', taskId);

        // ─── Log completion activity ──────────────────
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId,
            actorId: auth.userId,
            action: 'ai_progress',
            metadata: { step: 'done', label: 'Output ready for review', summary: result.summary },
        });

        // ─── Add comment with summary ─────────────────
        await db.from('TaskComment').insert({
            id: crypto.randomUUID(),
            taskId,
            userId: auth.userId,
            content: `🤖 **${brain.name}** completed this task:\n\n${result.summary || 'Output generated successfully.'}\n\n_Review the task description for the full deliverable._`,
            createdAt: now(),
        });

        return NextResponse.json({
            success: true,
            summary: result.summary,
            step: 'done',
        });
    } catch (error) {
        console.error('[execute-task] Error:', error);
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId,
            actorId: auth.userId,
            action: 'ai_progress',
            metadata: { step: 'error', label: 'Generation failed' },
        });
        return NextResponse.json({ error: 'Failed to execute task' }, { status: 500 });
    }
}
