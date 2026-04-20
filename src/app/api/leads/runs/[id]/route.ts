import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/leads/runs/[id]
 * Get a specific search run + its results.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    try {
        const { data: run, error: runErr } = await db
            .from('LeadSearchRun')
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (runErr) throw runErr;
        if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

        const { data: results } = await db
            .from('LeadResult')
            .select('*')
            .eq('searchRunId', id)
            .order('relevanceScore', { ascending: false });

        return NextResponse.json({ run, results: results || [] });
    } catch (err) {
        console.error('[/api/leads/runs/[id] GET]', err);
        return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 });
    }
}

/**
 * DELETE /api/leads/runs/[id]
 * Delete a search run and its results.
 */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    try {
        // Verify ownership
        const { data: run } = await db
            .from('LeadSearchRun')
            .select('id')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

        // Delete results first (cascade), then run
        await db.from('LeadResult').delete().eq('searchRunId', id);
        await db.from('LeadSearchRun').delete().eq('id', id);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/leads/runs/[id] DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete run' }, { status: 500 });
    }
}
