import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { executeSkillRuntime } from '@/lib/skills/runtime/executor';

/**
 * ═══════════════════════════════════════════════════════
 * POST /api/skills/scheduler/execute
 * ═══════════════════════════════════════════════════════
 *
 * Worker endpoint for executing a single scheduled skill run.
 * Called internally by the cron dispatcher — NOT by users.
 *
 * This runs in its own serverless function invocation with a
 * generous maxDuration, so OpenAI calls with web_search can
 * complete without being killed by Vercel's cron timeout.
 */

export const maxDuration = 300; // 5 minutes

const MODEL = 'gpt-5.4';

export async function POST(request: Request) {
    // ── Parse body ──────────────────────────────────────
    let body: {
        runId: string;
        skillId: string;
        scheduleId?: string;
        companyId?: string;
        secret?: string;
        manualTrigger?: boolean;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // ── Auth: cron secret for automated calls, skip for manual triggers ──
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || body.secret;
    const cronSecret = process.env.CRON_SECRET;

    if (!body.manualTrigger && cronSecret && secret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runId, skillId, scheduleId } = body;
    if (!runId || !skillId) {
        return NextResponse.json({ error: 'runId and skillId are required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const db = createAdminClient();
    const openai = new OpenAI({ apiKey });

    // ── Load skill ──────────────────────────────────────
    const { data: skill } = await db
        .from('AssistantSkill')
        .select('*')
        .eq('id', skillId)
        .single();

    if (!skill) {
        return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Resolve companyId from skill if not provided (manual trigger case)
    const companyId = body.companyId || skill.companyId;

    // ── Load schedule for runtime context ───────────────
    let scheduleTimezone = 'UTC';
    if (scheduleId) {
        const { data: schedule } = await db
            .from('SkillSchedule')
            .select('timezone, workspaceId')
            .eq('id', scheduleId)
            .single();
        if (schedule) {
            scheduleTimezone = schedule.timezone || 'UTC';
        }
    }

    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setUTCHours(0, 0, 0, 0);

    const runtimeContext = {
        execution_mode: body.manualTrigger ? 'manual' : 'scheduled',
        timezone: scheduleTimezone,
        generated_at: now.toISOString(),
        window_start: windowStart.toISOString(),
        window_end: now.toISOString(),
        schedule_id: scheduleId || null,
    };

    // ── Create or update SkillRun record ────────────────
    // For manual triggers, the SkillRun doesn't exist yet — create it
    // For cron dispatches, it was already created by the dispatcher as 'pending'
    if (body.manualTrigger) {
        await db.from('SkillRun').insert({
            id: runId,
            skillId: skill.id,
            scheduleId: scheduleId || null,
            companyId,
            triggerType: 'manual',
            status: 'running',
            startedAt: now.toISOString(),
            runtimeContext,
            inputPayload: { topic: skill.name, contentType: skill.key?.toUpperCase() },
        });
    } else {
        await db.from('SkillRun').update({
            status: 'running',
            runtimeContext,
        }).eq('id', runId);
    }

    try {
        // ── Runtime dispatch: try new executor for non-LEGACY skills ──
        if (skill.importMode && skill.importMode !== 'LEGACY' && skill.runtimeCategory !== 'content-generation') {
            try {
                const runtimeResult = await executeSkillRuntime({
                    companyId,
                    userId: 'system-scheduler',
                    skillId: skill.id,
                    topic: skill.name,
                    language: 'en',
                });

                if (runtimeResult) {
                    const title = skill.name + ' — ' + new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                    await db.from('SkillRun').update({
                        status: 'success',
                        finishedAt: new Date().toISOString(),
                        outputTitle: title,
                        outputText: runtimeResult.assistantMessage || '',
                        modelUsed: runtimeResult.executionMeta?.modelUsed || MODEL,
                        resultEnvelope: runtimeResult,
                        artifactIds: runtimeResult.artifacts?.map((a: any) => a.id) || [],
                        executionTrace: runtimeResult.executionTrace || null,
                    }).eq('id', runId);

                    return NextResponse.json({ status: 'success', runId });
                }
            } catch (runtimeErr) {
                console.warn(`[scheduler/execute] Runtime executor failed for ${skill.name}, falling back:`, runtimeErr);
            }
        }

        // ── Fallback: legacy OpenAI execution ───────────
        const baseRole = skill.instructionPrompt
            ? `You are an AI assistant executing a scheduled skill.\n\n=== SKILL-SPECIFIC INSTRUCTIONS ===\n${skill.instructionPrompt}`
            : `You are an AI assistant. Generate content for: ${skill.name}`;

        const systemPrompt = `${baseRole}

=== RUNTIME CONTEXT ===
Execution mode: scheduled
Timezone: ${scheduleTimezone}
Time window: ${runtimeContext.window_start} to ${runtimeContext.window_end}
Generated at: ${runtimeContext.generated_at}

RULES:
- Use web search to find current information when needed.
- Include source URLs as markdown links.
- Be professional, structured, and actionable.
- Output format: Full detailed output`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: systemPrompt,
            input: `Generate: ${skill.name}`,
            tools: [{ type: 'web_search_preview' }],
            temperature: 0.7,
        });

        const outputText = response.output_text || '';
        const title = skill.name + ' — ' + new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

        // Update run as success
        await db.from('SkillRun').update({
            status: 'success',
            finishedAt: new Date().toISOString(),
            outputTitle: title,
            outputText,
            modelUsed: MODEL,
        }).eq('id', runId);

        return NextResponse.json({ status: 'success', runId });

    } catch (execErr) {
        // Update run as failed
        const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
        await db.from('SkillRun').update({
            status: 'failed',
            finishedAt: new Date().toISOString(),
            errorMessage: errMsg,
        }).eq('id', runId);

        console.error(`[scheduler/execute] Skill "${skill.name}" failed:`, errMsg);
        return NextResponse.json({ status: 'failed', runId, error: errMsg }, { status: 500 });
    }
}
