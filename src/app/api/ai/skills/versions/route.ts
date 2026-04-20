import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/ai/skills/versions?skillId=xxx
 * Returns version history for a skill's instruction prompt.
 */
export async function GET(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const skillId = searchParams.get('skillId');

        if (!skillId) {
            return NextResponse.json({ error: 'skillId is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const { data: versions, error } = await db
            .from('SkillVersionLog')
            .select('id, version, instructionPrompt, changedBy, changeSummary, createdAt')
            .eq('skillId', skillId)
            .order('version', { ascending: false })
            .limit(20);

        if (error) throw error;
        return NextResponse.json({ versions: versions || [] });
    } catch (err) {
        console.error('[/api/ai/skills/versions GET]', err);
        return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
    }
}
