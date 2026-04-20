import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/* ─── Helper: get timezone offset in minutes ────────────── */

function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
    const localInTz = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));

    return Math.round((localInTz.getTime() - date.getTime()) / 60_000);
}

/* ─── Helper: compute next run time ─────────────────────── */

function computeNextRunAt(
    frequency: string,
    runAtTime: string,
    timezone: string,
    daysOfWeek?: number[] | null,
    intervalMinutes?: number | null,
): string {
    const now = new Date();

    if (frequency === 'interval' && intervalMinutes) {
        return new Date(now.getTime() + intervalMinutes * 60_000).toISOString();
    }

    const [hours, minutes] = runAtTime.split(':').map(Number);

    // Get the timezone offset so we can convert local time → UTC correctly
    const offsetMinutes = getTimezoneOffsetMinutes(now, timezone);

    const target = new Date(now);
    target.setUTCHours(hours, minutes, 0, 0);
    // Convert from "local time expressed as UTC" to actual UTC
    target.setUTCMinutes(target.getUTCMinutes() - offsetMinutes);
    target.setUTCDate(target.getUTCDate() + 1); // always next day minimum

    if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
        for (let i = 0; i < 7; i++) {
            const candidate = new Date(target);
            candidate.setUTCDate(candidate.getUTCDate() + i);
            if (daysOfWeek.includes(candidate.getUTCDay())) {
                return candidate.toISOString();
            }
        }
    }

    if (frequency === 'weekdays') {
        while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
            target.setUTCDate(target.getUTCDate() + 1);
        }
    }

    return target.toISOString();
}

/* ─── Helper: resolve base URL for internal API calls ───── */

function getBaseUrl(request: Request): string {
    // In production (Vercel), use VERCEL_URL or NEXT_PUBLIC_APP_URL
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

    // Locally, derive from the incoming request
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
}

/* ─── GET /api/skills/scheduler ─────────────────────────── *
 * Triggered by Vercel Cron every 10 minutes.
 *
 * FAST DISPATCHER — does NOT execute skills directly.
 * Instead, it:
 *   1. Finds due schedules
 *   2. Creates SkillRun records (status: 'pending')
 *   3. Updates schedule lastRunAt + nextRunAt immediately
 *   4. Fires off async execution requests to /api/skills/scheduler/execute
 *   5. Returns immediately
 * ──────────────────────────────────────────────────────── */

export async function GET(request: Request) {
    // Optional: verify cron secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createAdminClient();

    // Find due schedules
    const { data: dueSchedules, error: fetchErr } = await db
        .from('SkillSchedule')
        .select('*')
        .eq('isActive', true)
        .lte('nextRunAt', new Date().toISOString());

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!dueSchedules || dueSchedules.length === 0) {
        return NextResponse.json({ message: 'No due schedules', ran: 0 });
    }

    const baseUrl = getBaseUrl(request);
    const dispatched: { scheduleId: string; skillName: string; runId: string }[] = [];
    const skipped: { scheduleId: string; reason: string }[] = [];

    for (const schedule of dueSchedules) {
        // Fetch the skill
        const { data: skill } = await db
            .from('AssistantSkill')
            .select('id, name, key')
            .eq('id', schedule.skillId)
            .single();

        if (!skill) {
            skipped.push({ scheduleId: schedule.id, reason: 'Skill not found' });
            continue;
        }

        // Idempotency check: don't run if already ran today for this schedule
        const today = new Date().toISOString().split('T')[0];
        const { data: existingRun } = await db
            .from('SkillRun')
            .select('id')
            .eq('scheduleId', schedule.id)
            .eq('triggerType', 'scheduled')
            .gte('startedAt', `${today}T00:00:00Z`)
            .lte('startedAt', `${today}T23:59:59Z`)
            .limit(1);

        if (existingRun && existingRun.length > 0) {
            skipped.push({ scheduleId: schedule.id, reason: 'Already ran today' });
            // Still update nextRunAt
            await db.from('SkillSchedule').update({
                nextRunAt: computeNextRunAt(schedule.frequency, schedule.runAtTime, schedule.timezone, schedule.daysOfWeek, schedule.intervalMinutes),
                updatedAt: new Date().toISOString(),
            }).eq('id', schedule.id);
            continue;
        }

        // ── Create SkillRun record (pending) ────────────
        const runId = crypto.randomUUID();
        const now = new Date();

        await db.from('SkillRun').insert({
            id: runId,
            skillId: skill.id,
            scheduleId: schedule.id,
            companyId: schedule.companyId,
            triggerType: 'scheduled',
            status: 'pending',
            startedAt: now.toISOString(),
            inputPayload: { topic: skill.name, contentType: skill.key.toUpperCase() },
        });

        // ── Update schedule immediately ─────────────────
        await db.from('SkillSchedule').update({
            lastRunAt: now.toISOString(),
            nextRunAt: computeNextRunAt(schedule.frequency, schedule.runAtTime, schedule.timezone, schedule.daysOfWeek, schedule.intervalMinutes),
            updatedAt: now.toISOString(),
        }).eq('id', schedule.id);

        // ── Fire-and-forget: dispatch execution ─────────
        const executeUrl = `${baseUrl}/api/skills/scheduler/execute${process.env.CRON_SECRET ? `?secret=${process.env.CRON_SECRET}` : ''}`;

        // Non-awaited fetch — this fires the request and does NOT wait for it
        fetch(executeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                runId,
                skillId: skill.id,
                scheduleId: schedule.id,
                companyId: schedule.companyId,
                secret: process.env.CRON_SECRET || '',
            }),
        }).catch(err => {
            console.error(`[scheduler] Failed to dispatch execution for run ${runId}:`, err);
        });

        dispatched.push({ scheduleId: schedule.id, skillName: skill.name, runId });
    }

    return NextResponse.json({
        message: `Dispatched ${dispatched.length} skill executions`,
        dispatched: dispatched.length,
        skipped: skipped.length,
        details: { dispatched, skipped },
    });
}
