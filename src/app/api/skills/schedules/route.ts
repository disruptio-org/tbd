import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/* ─── Helper: get timezone offset in minutes ────────────── */

function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
    // Format the date in the target timezone to extract its local components
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
    const localInTz = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));

    // Offset = localTimeInTz (as UTC millis) - actualUTC (millis)
    // Positive means timezone is ahead of UTC (e.g. +60 for UTC+1)
    return Math.round((localInTz.getTime() - date.getTime()) / 60_000);
}

/* ─── Helper: compute nextRunAt from schedule params ────── */

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

    // Parse runAtTime "HH:MM"
    const [hours, minutes] = runAtTime.split(':').map(Number);

    // Get the timezone offset so we can convert local time → UTC correctly
    const offsetMinutes = getTimezoneOffsetMinutes(now, timezone);

    // Build today's target time: start with the local time in UTC, then subtract the offset
    const target = new Date(now);
    target.setUTCHours(hours, minutes, 0, 0);
    // Convert from "local time expressed as UTC" to actual UTC
    target.setUTCMinutes(target.getUTCMinutes() - offsetMinutes);

    // If target is in the past today, move to tomorrow
    if (target <= now) {
        target.setUTCDate(target.getUTCDate() + 1);
    }

    // For weekly frequency, find the next matching day
    if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
        for (let i = 0; i < 7; i++) {
            const candidate = new Date(target);
            candidate.setUTCDate(candidate.getUTCDate() + i);
            if (daysOfWeek.includes(candidate.getUTCDay())) {
                return candidate.toISOString();
            }
        }
    }

    // For weekdays, skip weekends
    if (frequency === 'weekdays') {
        while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
            target.setUTCDate(target.getUTCDate() + 1);
        }
    }

    return target.toISOString();
}

/* ─── GET /api/skills/schedules ────────────────────────── */

export async function GET(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get('skillId');

    const db = createAdminClient();
    let query = db
        .from('SkillSchedule')
        .select('*')
        .eq('companyId', auth.dbUser.companyId)
        .order('createdAt', { ascending: false });

    if (skillId) query = query.eq('skillId', skillId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ schedules: data || [] });
}

/* ─── POST /api/skills/schedules ───────────────────────── */

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
        skillId,
        name,
        frequency = 'daily',
        runAtTime = '08:00',
        timezone = 'UTC',
        daysOfWeek = null,
        intervalMinutes = null,
        workspaceId = null,
        outputTarget = 'database',
        outputFormat = 'full',
        showOnToday = false,
        includeInBrief = false,
    } = body;

    if (!skillId || !name) {
        return NextResponse.json({ error: 'skillId and name are required' }, { status: 400 });
    }

    const nextRunAt = computeNextRunAt(frequency, runAtTime, timezone, daysOfWeek, intervalMinutes);

    const db = createAdminClient();
    const { data, error } = await db.from('SkillSchedule').insert({
        skillId,
        companyId: auth.dbUser.companyId,
        workspaceId,
        name,
        frequency,
        runAtTime,
        timezone,
        daysOfWeek,
        intervalMinutes,
        isActive: true,
        nextRunAt,
        outputTarget,
        outputFormat,
        showOnToday,
        includeInBrief,
        createdBy: auth.dbUser.id,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ schedule: data }, { status: 201 });
}

/* ─── PATCH /api/skills/schedules?id=xxx ───────────────── */

export async function PATCH(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    // Copy allowed fields
    for (const key of ['name', 'frequency', 'runAtTime', 'timezone', 'daysOfWeek', 'intervalMinutes', 'isActive', 'workspaceId', 'outputTarget', 'outputFormat', 'showOnToday', 'includeInBrief']) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    // Recompute nextRunAt if schedule params changed
    if (body.frequency || body.runAtTime || body.timezone || body.daysOfWeek || body.intervalMinutes) {
        const freq = body.frequency || 'daily';
        const time = body.runAtTime || '08:00';
        const tz = body.timezone || 'UTC';
        updates.nextRunAt = computeNextRunAt(freq, time, tz, body.daysOfWeek, body.intervalMinutes);
    }

    const db = createAdminClient();
    const { data, error } = await db.from('SkillSchedule')
        .update(updates)
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ schedule: data });
}

/* ─── DELETE /api/skills/schedules?id=xxx ──────────────── */

export async function DELETE(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const db = createAdminClient();
    const { error } = await db.from('SkillSchedule')
        .delete()
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ deleted: true });
}
