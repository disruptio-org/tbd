import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteContext {
    params: Promise<{ id: string }>;
}

/**
 * PUT /api/documents/folders/[id]
 * Rename a folder.
 */
export async function PUT(req: Request, context: RouteContext) {
    try {
        const auth = await getCurrentUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await context.params;
        const { name } = await req.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const { data, error } = await db.from('DocFolder')
            .update({ name: name.trim() })
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data);
    } catch (error) {
        console.error('[folders PUT]', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

/**
 * DELETE /api/documents/folders/[id]
 * Delete a folder (moves its documents to root).
 */
export async function DELETE(_req: Request, context: RouteContext) {
    try {
        const auth = await getCurrentUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await context.params;
        const db = createAdminClient();

        // Move documents in this folder to root (set folderId = null)
        await db.from('Document')
            .update({ folderId: null })
            .eq('folderId', id)
            .eq('companyId', auth.dbUser.companyId);

        // Move child folders to root (set parentId = null)
        await db.from('DocFolder')
            .update({ parentId: null })
            .eq('parentId', id)
            .eq('companyId', auth.dbUser.companyId);

        // Delete the folder
        const { error } = await db.from('DocFolder')
            .delete()
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[folders DELETE]', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
