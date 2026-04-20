import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/leads/runs
 * List past search runs for the current company.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: runs, error } = await db
            .from('LeadSearchRun')
            .select('id, title, query, status, searchContext, createdAt')
            .eq('companyId', auth.dbUser.companyId)
            .order('createdAt', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Get result counts for each run
        const runIds = (runs || []).map(r => r.id);
        let resultCounts: Record<string, number> = {};

        if (runIds.length > 0) {
            const { data: results } = await db
                .from('LeadResult')
                .select('searchRunId')
                .in('searchRunId', runIds);

            if (results) {
                for (const r of results) {
                    resultCounts[r.searchRunId] = (resultCounts[r.searchRunId] || 0) + 1;
                }
            }
        }

        return NextResponse.json({
            runs: (runs || []).map(run => ({
                ...run,
                resultCount: resultCounts[run.id] || 0,
            })),
        });
    } catch (err) {
        console.error('[/api/leads/runs GET]', err);
        return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
    }
}
