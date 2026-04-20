import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/tasks/boards/[id]/columns — Create column
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: boardId } = await params;
    const db = createAdminClient();

    // Verify board ownership
    const { data: board } = await db
        .from('TaskBoard')
        .select('id')
        .eq('id', boardId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    const { name, color, isDone } = await req.json();
    if (!name?.trim()) {
        return NextResponse.json({ error: 'Column name is required' }, { status: 400 });
    }

    // Get max position
    const { data: cols } = await db
        .from('TaskBoardColumn')
        .select('position')
        .eq('boardId', boardId)
        .order('position', { ascending: false })
        .limit(1);

    const nextPosition = (cols && cols.length > 0 ? cols[0].position : -1) + 1;

    const columnId = crypto.randomUUID();
    await db.from('TaskBoardColumn').insert({
        id: columnId,
        boardId,
        name: name.trim(),
        position: nextPosition,
        color: color || null,
        isDone: isDone || false,
        isDefault: false,
    });

    return NextResponse.json({ column: { id: columnId, boardId, name: name.trim(), position: nextPosition, color, isDone: isDone || false, isDefault: false } });
}
