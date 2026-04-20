import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/* ─── GET /api/skills/runs ─────────────────────────────── */

export async function GET(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get('skillId');
    const scheduleId = searchParams.get('scheduleId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const db = createAdminClient();
    let query = db
        .from('SkillRun')
        .select('*')
        .eq('companyId', auth.dbUser.companyId)
        .order('startedAt', { ascending: false })
        .limit(limit);

    if (skillId) query = query.eq('skillId', skillId);
    if (scheduleId) query = query.eq('scheduleId', scheduleId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ runs: data || [] });
}
