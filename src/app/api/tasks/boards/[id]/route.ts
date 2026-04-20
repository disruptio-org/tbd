import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/tasks/boards/[id] — Get board with columns + tasks
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: board } = await db
        .from('TaskBoard')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    // Columns
    const { data: columns } = await db
        .from('TaskBoardColumn')
        .select('*')
        .eq('boardId', id)
        .order('position', { ascending: true });

    // Tasks with assignee info
    const { data: tasks } = await db
        .from('Task')
        .select('*')
        .eq('boardId', id)
        .order('position', { ascending: true });

    // Get assignee names for tasks that have assignees
    const assigneeIds = [...new Set((tasks || []).filter(t => t.assigneeId).map(t => t.assigneeId))];
    let usersMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    if (assigneeIds.length > 0) {
        const { data: users } = await db
            .from('User')
            .select('id, name, avatarUrl')
            .in('id', assigneeIds);
        usersMap = Object.fromEntries((users || []).map(u => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));
    }

    const enrichedTasks = (tasks || []).map(t => ({
        ...t,
        assigneeName: t.assigneeId ? usersMap[t.assigneeId]?.name || null : null,
        assigneeAvatar: t.assigneeId ? usersMap[t.assigneeId]?.avatarUrl || null : null,
    }));

    return NextResponse.json({
        board,
        columns: columns || [],
        tasks: enrichedTasks,
    });
}

/**
 * PUT /api/tasks/boards/[id] — Update board
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const db = createAdminClient();

    // Verify ownership
    const { data: board } = await db
        .from('TaskBoard')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    // projectId is immutable after creation — scope cannot be changed

    await db.from('TaskBoard').update(updates).eq('id', id);

    return NextResponse.json({ success: true });
}

/**
 * DELETE /api/tasks/boards/[id] — Delete board (cascades)
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: board } = await db
        .from('TaskBoard')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    await db.from('TaskBoard').delete().eq('id', id);

    return NextResponse.json({ success: true });
}
