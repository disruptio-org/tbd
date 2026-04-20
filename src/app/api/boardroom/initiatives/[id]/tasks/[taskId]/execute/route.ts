import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { openai } from '@/lib/openai';
import { canTransitionTask } from '@/lib/boardroom/status-engine';
import type { TaskStatus } from '@/lib/boardroom/constants';

type RouteContext = { params: Promise<{ id: string; taskId: string }> };

/**
 * POST /api/boardroom/initiatives/[id]/tasks/[taskId]/execute (V2)
 *
 * Executes a task using: member profile + selected skill + task spec + prior outputs.
 * Task must be APPROVED_TO_RUN → transitions to RUNNING → then OUTPUT_READY.
 */
export async function POST(_req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, taskId } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Verify initiative
    const { data: initiative } = await db
        .from('Initiative')
        .select('id, title, objective, planSummary, workType, status')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });
    if (initiative.status !== 'IN_PROGRESS' && initiative.status !== 'WAITING_HUMAN_INPUT') {
        return NextResponse.json({ error: 'Initiative must be IN_PROGRESS or WAITING_HUMAN_INPUT' }, { status: 400 });
    }

    // Fetch the task
    const { data: task } = await db
        .from('InitiativeTask')
        .select('*')
        .eq('id', taskId)
        .eq('initiativeId', id)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // Must be APPROVED_TO_RUN
    const from = task.status as TaskStatus;
    if (!canTransitionTask(from, 'RUNNING')) {
        return NextResponse.json({ error: `Task must be APPROVED_TO_RUN to execute (current: ${from})` }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Transition to RUNNING
    await db.from('InitiativeTask').update({
        status: 'RUNNING',
        updatedAt: now,
    }).eq('id', taskId);

    // Fetch completed/validated tasks for context
    const { data: allTasks } = await db
        .from('InitiativeTask')
        .select('id, title, status, outputSummary')
        .eq('initiativeId', id)
        .order('position');

    const completedContext = (allTasks || [])
        .filter(t => t.status === 'VALIDATED' || t.status === 'OUTPUT_READY')
        .map(t => `- ${t.title}: ${t.outputSummary || 'No output recorded'}`)
        .join('\n');

    // Company context
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

    // Brain profile context
    let brainContext = '';
    const brainId = task.assignedBrainId;
    if (brainId) {
        const { data: brain } = await db
            .from('AIBrainProfile')
            .select('name, brainType, description')
            .eq('id', brainId)
            .maybeSingle();
        if (brain) {
            brainContext = `\nYOUR ROLE: ${brain.name} (${brain.brainType})`;
            if (brain.description) brainContext += `\nDESCRIPTION: ${brain.description}`;
        }
    } else if (task.assignedBrainType) {
        brainContext = `\nYOUR ROLE: ${task.assignedBrainType} team member`;
    }

    // Selected skill context
    let skillContext = '';
    if (task.selectedSkillId) {
        const { data: skill } = await db
            .from('AssistantSkill')
            .select('name, description, instructionPrompt, outputSchema, requiredInputs')
            .eq('id', task.selectedSkillId)
            .maybeSingle();
        if (skill) {
            skillContext = `\nSELECTED SKILL: ${skill.name}`;
            if (skill.description) skillContext += `\nSKILL DESCRIPTION: ${skill.description}`;
            if (skill.instructionPrompt) skillContext += `\nSKILL INSTRUCTIONS:\n${skill.instructionPrompt}`;
            if (skill.outputSchema) skillContext += `\nEXPECTED OUTPUT FORMAT: ${JSON.stringify(skill.outputSchema)}`;
        }
    }

    // Task spec context
    let taskSpecContext = `\nTASK TITLE: ${task.title}`;
    if (task.description) taskSpecContext += `\nTASK DESCRIPTION: ${task.description}`;
    if (task.purpose) taskSpecContext += `\nTASK PURPOSE: ${task.purpose}`;
    if (task.acceptanceCriteria) taskSpecContext += `\nACCEPTANCE CRITERIA: ${task.acceptanceCriteria}`;
    if (task.deliverables) {
        const deliverables = Array.isArray(task.deliverables) ? task.deliverables : [];
        if (deliverables.length > 0) {
            taskSpecContext += `\nEXPECTED DELIVERABLES:`;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            deliverables.forEach((d: any, i: number) => {
                taskSpecContext += `\n  ${i + 1}. [${d.type || 'document'}] ${d.description || 'Deliverable'}`;
            });
        }
    }

    const systemPrompt = `You are an AI team member executing a task within a Boardroom initiative.

COMPANY: ${company?.name || 'Unknown'}
${company?.webContext ? `ABOUT: ${company.webContext}` : ''}
${dna?.missionVision ? `MISSION: ${dna.missionVision}` : ''}
${dna?.productsServices ? `PRODUCTS/SERVICES: ${dna.productsServices}` : ''}
${dna?.targetAudience ? `TARGET AUDIENCE: ${dna.targetAudience}` : ''}
${dna?.tonePersonality ? `TONE: ${dna.tonePersonality}` : ''}
${brainContext}
${skillContext}

INITIATIVE: ${initiative.title}
OBJECTIVE: ${initiative.objective || 'Not specified'}
PLAN SUMMARY: ${initiative.planSummary || 'Not available'}

${completedContext ? `COMPLETED TASKS (use as context):\n${completedContext}` : ''}

YOUR CURRENT TASK:
${taskSpecContext}
${task.revisionCount > 0 ? `\nNOTE: This is revision #${task.revisionCount}. Previous output was not accepted. Improve on your previous work.` : ''}

INSTRUCTIONS:
1. Execute this task thoroughly and produce actionable output
2. Follow the skill instructions if provided
3. Meet the acceptance criteria
4. Produce all expected deliverables
5. Be specific, detailed, and practical
6. Do NOT ask follow-up questions — deliver the best output you can

Respond with a JSON object:
{
  "output": "The detailed deliverable/output for this task (can be long, multi-paragraph)",
  "summary": "A 1-2 sentence summary of what was produced",
  "artifactTitle": "A title for the artifact if applicable, or null",
  "artifactType": "document|design|code|data|communication|plan|other",
  "reasoningNotes": "Brief notes on your approach and decisions (optional)"
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
            // Revert to APPROVED_TO_RUN on failure
            await db.from('InitiativeTask').update({ status: 'APPROVED_TO_RUN', updatedAt: now }).eq('id', taskId);
            return NextResponse.json({ error: 'Empty AI response' }, { status: 500 });
        }

        let result;
        try {
            result = JSON.parse(raw);
        } catch {
            result = { output: raw, summary: 'Task executed', artifactTitle: null, artifactType: 'document' };
        }

        // Transition to OUTPUT_READY
        await db.from('InitiativeTask').update({
            status: 'OUTPUT_READY',
            outputSummary: result.summary || result.output?.substring(0, 500),
            deliveredAt: now,
            updatedAt: now,
        }).eq('id', taskId);

        // Create artifact if produced
        if (result.artifactTitle && result.output) {
            await db.from('InitiativeArtifact').insert({
                id: crypto.randomUUID(),
                initiativeId: id,
                taskId: taskId,
                artifactType: result.artifactType || 'document',
                title: result.artifactTitle,
                content: result.output,
                status: 'DRAFT',
                createdAt: now,
                updatedAt: now,
            });
        }

        // Log execution event
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'ai_member',
            actorLabel: task.assignedBrainType || 'AI',
            action: 'task_delivered',
            description: result.summary || `Task "${task.title}" executed — output ready for review`,
        });

        // If initiative was WAITING_HUMAN_INPUT, move back to IN_PROGRESS
        if (initiative.status === 'WAITING_HUMAN_INPUT') {
            await db.from('Initiative').update({
                status: 'IN_PROGRESS',
                updatedAt: now,
            }).eq('id', id);
        }

        return NextResponse.json({
            success: true,
            output: result.output,
            summary: result.summary,
            artifactTitle: result.artifactTitle,
            reasoningNotes: result.reasoningNotes,
            status: 'OUTPUT_READY',
        });
    } catch (error) {
        console.error('[boardroom/execute] Error:', error);
        // Revert to APPROVED_TO_RUN on failure
        await db.from('InitiativeTask').update({ status: 'APPROVED_TO_RUN', updatedAt: now }).eq('id', taskId);
        return NextResponse.json({ error: 'Failed to execute task' }, { status: 500 });
    }
}
