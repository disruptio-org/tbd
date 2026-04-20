import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/knowledge-gaps
 * Returns all KnowledgeGap records for the current company, ordered by score desc.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: gaps, error } = await db
            .from('KnowledgeGap')
            .select('*')
            .eq('companyId', auth.dbUser.companyId)
            .order('score', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ gaps: gaps ?? [] });
    } catch (err) {
        console.error('[/api/knowledge-gaps GET]', err);
        return NextResponse.json({ error: 'Failed to fetch gaps' }, { status: 500 });
    }
}
