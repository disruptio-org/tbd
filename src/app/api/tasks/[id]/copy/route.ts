import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/tasks/[id]/copy — Deep copy task (+ checklists) to target column
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { targetColumnId, targetBoardId } = await req.json();

    const db = createAdminClient();

    const { data: task } = await db.from('Task').select('*').eq('id', id).eq('companyId', auth.dbUser.companyId).maybeSingle();
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const boardId = targetBoardId || task.boardId;
    const columnId = targetColumnId || task.columnId;

    // Get max position in target column
    const { data: maxTasks } = await db.from('Task').select('position').eq('columnId', columnId).order('position', { ascending: false }).limit(1);
    const nextPosition = (maxTasks && maxTasks.length > 0 ? maxTasks[0].position : -1) + 1;

    const newTaskId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.from('Task').insert({
        id: newTaskId,
        companyId: auth.dbUser.companyId,
        boardId,
        columnId,
        projectId: task.projectId,
        title: `${task.title} (copy)`,
        description: task.description,
        priority: task.priority,
        position: nextPosition,
        startDate: task.startDate,
        dueDate: task.dueDate,
        isCompleted: false,
        coverColor: task.coverColor,
        coverImage: task.coverImage,
        labels: task.labels,
        assigneeId: task.assigneeId,
        reporterId: auth.dbUser.id,
        sourceType: task.sourceType,
        sourceEntityId: task.sourceEntityId,
        updatedAt: now,
    });

    // Copy checklists
    const { data: checklists } = await db.from('TaskChecklist').select('*').eq('taskId', id).order('position', { ascending: true });
    for (const cl of checklists || []) {
        const newClId = crypto.randomUUID();
        await db.from('TaskChecklist').insert({
            id: newClId,
            taskId: newTaskId,
            title: cl.title,
            position: cl.position,
        });

        const { data: items } = await db.from('TaskChecklistItem').select('*').eq('checklistId', cl.id).order('position', { ascending: true });
        for (const item of items || []) {
            await db.from('TaskChecklistItem').insert({
                id: crypto.randomUUID(),
                checklistId: newClId,
                title: item.title,
                isChecked: false,
                position: item.position,
            });
        }
    }

    // Log activity
    await db.from('TaskActivity').insert({
        id: crypto.randomUUID(),
        taskId: newTaskId,
        actorId: auth.dbUser.id,
        action: 'copied',
        metadata: { fromTaskId: id, fromTitle: task.title },
    });

    return NextResponse.json({ task: { id: newTaskId, title: `${task.title} (copy)` } });
}
