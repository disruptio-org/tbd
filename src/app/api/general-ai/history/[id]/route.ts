import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        const db = createAdminClient();
        const { data: run, error } = await db.from('GeneralAIGenerationRun').select('*').eq('id', id).eq('companyId', auth.dbUser.companyId).maybeSingle();
        if (error) throw error;
        if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        return NextResponse.json({ run });
    } catch (err) { console.error('[/api/general-ai/history/[id] GET]', err); return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 }); }
}
