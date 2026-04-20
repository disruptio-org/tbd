import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PUT /api/tasks/columns/[id] — Update column
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    // Verify ownership via board → company
    const { data: col } = await db
        .from('TaskBoardColumn')
        .select('id, boardId')
        .eq('id', id)
        .maybeSingle();

    if (!col) return NextResponse.json({ error: 'Column not found' }, { status: 404 });

    const { data: board } = await db
        .from('TaskBoard')
        .select('id')
        .eq('id', col.boardId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!board) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.position !== undefined) updates.position = body.position;
    if (body.color !== undefined) updates.color = body.color || null;
    if (body.isDone !== undefined) updates.isDone = body.isDone;

    if (Object.keys(updates).length > 0) {
        await db.from('TaskBoardColumn').update(updates).eq('id', id);
    }

    return NextResponse.json({ success: true });
}

/**
 * DELETE /api/tasks/columns/[id] — Delete column (reject if has tasks)
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: col } = await db
        .from('TaskBoardColumn')
        .select('id, boardId, isDefault')
        .eq('id', id)
        .maybeSingle();

    if (!col) return NextResponse.json({ error: 'Column not found' }, { status: 404 });

    if (col.isDefault) {
        return NextResponse.json({ error: 'Cannot delete the default column' }, { status: 400 });
    }

    const { data: board } = await db
        .from('TaskBoard')
        .select('id')
        .eq('id', col.boardId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!board) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    // Check if column has tasks
    const { count } = await db
        .from('Task')
        .select('*', { count: 'exact', head: true })
        .eq('columnId', id);

    if (count && count > 0) {
        return NextResponse.json({ error: 'Column has tasks. Move them first.' }, { status: 400 });
    }

    await db.from('TaskBoardColumn').delete().eq('id', id);

    return NextResponse.json({ success: true });
}
