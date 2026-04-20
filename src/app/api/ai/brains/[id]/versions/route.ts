// ─── GET /api/ai/brains/[id]/versions — Version history ──

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Verify brain ownership
        const { data: brain } = await db
            .from('AIBrainProfile')
            .select('id')
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .maybeSingle();
        if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });

        const { data: versions } = await db
            .from('AIBrainVersion')
            .select('id, versionNumber, status, changeSummary, publishedAt, createdAt, createdById')
            .eq('brainProfileId', id)
            .order('versionNumber', { ascending: false });

        return NextResponse.json({ versions: versions || [] });
    } catch (error) {
        console.error('[ai/brains/[id]/versions] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
    }
}
