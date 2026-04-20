import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/tasks — List tasks (query: boardId, assigneeId, priority)
 */
export async function GET(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('boardId');

    if (!boardId) {
        return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
    }

    const db = createAdminClient();

    // Verify board ownership
    const { data: board } = await db
        .from('TaskBoard')
        .select('id')
        .eq('id', boardId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    let query = db
        .from('Task')
        .select('*')
        .eq('boardId', boardId);

    const assigneeId = searchParams.get('assigneeId');
    if (assigneeId) query = query.eq('assigneeId', assigneeId);

    const priority = searchParams.get('priority');
    if (priority) query = query.eq('priority', priority);

    const { data: tasks } = await query.order('position', { ascending: true });

    return NextResponse.json({ tasks: tasks || [] });
}

/**
 * POST /api/tasks — Create task
 */
export async function POST(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { boardId, columnId, title, description, priority, dueDate, labels, assigneeId, sourceType, sourceEntityId, projectId } = body;

        if (!boardId || !columnId || !title?.trim()) {
            return NextResponse.json({ error: 'boardId, columnId and title are required' }, { status: 400 });
        }

        const db = createAdminClient();

        // Verify board ownership
        const { data: board } = await db
            .from('TaskBoard')
            .select('id')
            .eq('id', boardId)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

        // Get max position in column
        const { data: maxTasks } = await db
            .from('Task')
            .select('position')
            .eq('columnId', columnId)
            .order('position', { ascending: false })
            .limit(1);

        const nextPosition = (maxTasks && maxTasks.length > 0 ? maxTasks[0].position : -1) + 1;

        const taskId = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.from('Task').insert({
            id: taskId,
            companyId: auth.dbUser.companyId,
            boardId,
            columnId,
            projectId: projectId || null,
            title: title.trim(),
            description: description?.trim() || null,
            priority: priority || 'medium',
            position: nextPosition,
            dueDate: dueDate || null,
            labels: labels || null,
            assigneeId: assigneeId || null,
            reporterId: auth.dbUser.id,
            sourceType: sourceType || 'MANUAL',
            sourceEntityId: sourceEntityId || null,
            updatedAt: now,
        });

        // Log activity
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId,
            actorId: auth.dbUser.id,
            action: 'created',
            metadata: { title: title.trim() },
        });

        return NextResponse.json({
            task: {
                id: taskId,
                companyId: auth.dbUser.companyId,
                boardId,
                columnId,
                title: title.trim(),
                description: description?.trim() || null,
                priority: priority || 'medium',
                position: nextPosition,
                dueDate: dueDate || null,
                labels: labels || null,
                assigneeId: assigneeId || null,
                reporterId: auth.dbUser.id,
                sourceType: sourceType || 'MANUAL',
            },
        });
    } catch (error) {
        console.error('[tasks] POST error:', error);
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
}
