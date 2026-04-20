import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET    /api/product/drafts/[id] — Get a single draft.
 * PUT    /api/product/drafts/[id] — Update a draft.
 * DELETE /api/product/drafts/[id] — Delete a draft.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const db = createAdminClient();
        const { data: draft, error } = await db
            .from('ProductDraft')
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (error) throw error;
        if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

        return NextResponse.json({ draft });
    } catch (err) {
        console.error('[/api/product/drafts/[id] GET]', err);
        return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const { title, content, metadata } = body;

        const db = createAdminClient();
        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if (title !== undefined) updates.title = title.trim();
        if (content !== undefined) updates.content = content;
        if (metadata !== undefined) updates.metadata = metadata;

        const { error } = await db
            .from('ProductDraft')
            .update(updates)
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/product/drafts/[id] PUT]', err);
        return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const db = createAdminClient();
        await db
            .from('ProductDraft')
            .delete()
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/product/drafts/[id] DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }
}
