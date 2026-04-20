import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/tasks/[id]/move — Move task to different column and/or position
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { columnId, position } = await req.json();

    if (!columnId) {
        return NextResponse.json({ error: 'columnId is required' }, { status: 400 });
    }

    const db = createAdminClient();

    const { data: task } = await db
        .from('Task')
        .select('id, columnId, boardId')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const oldColumnId = task.columnId;

    // Get column names for activity log
    let fromName = '', toName = '';
    if (oldColumnId !== columnId) {
        const { data: cols } = await db
            .from('TaskBoardColumn')
            .select('id, name, isDone')
            .in('id', [oldColumnId, columnId]);

        const colMap = Object.fromEntries((cols || []).map(c => [c.id, c]));
        fromName = colMap[oldColumnId]?.name || '';
        toName = colMap[columnId]?.name || '';
    }

    // Update task
    const updates: Record<string, unknown> = {
        columnId,
        updatedAt: new Date().toISOString(),
    };
    if (position !== undefined) updates.position = position;

    await db.from('Task').update(updates).eq('id', id);

    // Log move activity
    if (oldColumnId !== columnId) {
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId: id,
            actorId: auth.dbUser.id,
            action: 'moved',
            metadata: { from: fromName, to: toName, fromColumnId: oldColumnId, toColumnId: columnId },
        });
    }

    return NextResponse.json({ success: true });
}
