import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/knowledge-gaps/[id]
 * Updates the status of a KnowledgeGap (resolved | ignored | open).
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    try {
        const { status } = await request.json();
        if (!['open', 'resolved', 'ignored'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const db = createAdminClient();
        const { data, error } = await db
            .from('KnowledgeGap')
            .update({ status, updatedAt: new Date().toISOString() })
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId) // multi-tenant isolation
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ gap: data });
    } catch (err) {
        console.error('[/api/knowledge-gaps/[id] PATCH]', err);
        return NextResponse.json({ error: 'Failed to update gap' }, { status: 500 });
    }
}
