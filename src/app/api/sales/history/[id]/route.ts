import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/sales/history/[id] — Get a single generation run by id.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const db = createAdminClient();
        const { data: run, error } = await db
            .from('SalesGenerationRun')
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (error) throw error;
        if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

        return NextResponse.json({ run });
    } catch (err) {
        console.error('[/api/sales/history/[id] GET]', err);
        return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 });
    }
}
