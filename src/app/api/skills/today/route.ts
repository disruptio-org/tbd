import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/skills/today
 * Returns today's skill insights for schedules with showOnToday=true.
 * Pass ?filter=brief to get schedules with includeInBrief=true instead.
 * Each insight includes the latest successful SkillRun output.
 */
export async function GET(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Support filtering: 'today' = showOnToday, 'brief' = includeInBrief, default = either
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');

    // 1. Get all active schedules with the relevant flag(s)
    let query = db
        .from('SkillSchedule')
        .select('id, skillId, name, timezone, runAtTime, showOnToday, includeInBrief')
        .eq('companyId', companyId)
        .eq('isActive', true);

    if (filter === 'brief') {
        query = query.eq('includeInBrief', true);
    } else if (filter === 'today') {
        query = query.eq('showOnToday', true);
    } else {
        // Default: return schedules with EITHER flag set
        query = query.or('showOnToday.eq.true,includeInBrief.eq.true');
    }

    const { data: schedules, error: schErr } = await query;

    console.log(`[skills/today] filter=${filter || 'any'}, companyId=${companyId}, schedules found=${schedules?.length || 0}, error=${schErr?.message || 'none'}`);

    if (schErr) return NextResponse.json({ error: schErr.message }, { status: 500 });
    if (!schedules || schedules.length === 0) {
        return NextResponse.json({ insights: [] });
    }

    // 2. Get the skill info for all relevant skills
    const skillIds = [...new Set(schedules.map(s => s.skillId))];
    const { data: skills } = await db
        .from('AssistantSkill')
        .select('id, name, icon, key, runtimeCategory, responseMode, compatibilityState')
        .in('id', skillIds);

    const skillMap = new Map((skills || []).map(s => [s.id, s]));

    // 3. For each schedule, get the latest successful run
    const insights = [];
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60_000);

    for (const schedule of schedules) {
        const { data: latestRun, error: runErr } = await db
            .from('SkillRun')
            .select('id, outputTitle, outputText, startedAt, finishedAt, status, modelUsed')
            .eq('scheduleId', schedule.id)
            .eq('status', 'success')
            .order('startedAt', { ascending: false })
            .limit(1)
            .maybeSingle();

        console.log(`[skills/today] schedule=${schedule.id} (${schedule.name}), run found=${!!latestRun}, hasText=${!!latestRun?.outputText}, runErr=${runErr?.message || 'none'}`);

        if (!latestRun || !latestRun.outputText) continue;

        const skill = skillMap.get(schedule.skillId);
        const generatedAt = latestRun.finishedAt || latestRun.startedAt;
        const isNew = new Date(generatedAt) > twoHoursAgo;

        // Extract preview (first 180 chars, strip markdown)
        const outputPreview = latestRun.outputText
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/#{1,6}\s/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .substring(0, 180)
            .trim() + '...';

        insights.push({
            scheduleId: schedule.id,
            runId: latestRun.id,
            skillName: skill?.name || schedule.name,
            skillIcon: skill?.icon || null,
            skillKey: skill?.key || null,
            outputTitle: latestRun.outputTitle,
            outputPreview,
            outputText: latestRun.outputText,
            generatedAt,
            isNew,
            timezone: schedule.timezone,
            runAtTime: schedule.runAtTime,
            modelUsed: latestRun.modelUsed || null,
        });
    }

    return NextResponse.json({ insights });
}
