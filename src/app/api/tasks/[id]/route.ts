import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/tasks/[id] — Get task with comments, activity, links, checklists, watchers
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: task } = await db
        .from('Task')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // Fetch comments
    const { data: comments } = await db
        .from('TaskComment')
        .select('*')
        .eq('taskId', id)
        .order('createdAt', { ascending: true });

    // Enrich comments with user names
    const commentUserIds = [...new Set((comments || []).map(c => c.userId))];
    let usersMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    if (commentUserIds.length > 0) {
        const { data: users } = await db.from('User').select('id, name, avatarUrl').in('id', commentUserIds);
        usersMap = Object.fromEntries((users || []).map(u => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));
    }

    const enrichedComments = (comments || []).map(c => ({
        ...c,
        userName: usersMap[c.userId]?.name || 'Unknown',
        userAvatar: usersMap[c.userId]?.avatarUrl || null,
    }));

    // Fetch activity
    const { data: activity } = await db
        .from('TaskActivity')
        .select('*')
        .eq('taskId', id)
        .order('createdAt', { ascending: false })
        .limit(50);

    // Enrich activity with actor names
    const actorIds = [...new Set((activity || []).map(a => a.actorId))];
    if (actorIds.length > 0) {
        const { data: actors } = await db.from('User').select('id, name').in('id', actorIds);
        const actorsMap = Object.fromEntries((actors || []).map(u => [u.id, u.name]));
        (activity || []).forEach(a => { (a as Record<string, unknown>).actorName = actorsMap[a.actorId] || 'Unknown'; });
    }

    // Fetch links
    const { data: links } = await db
        .from('TaskLink')
        .select('*')
        .eq('taskId', id)
        .order('createdAt', { ascending: false });

    // Fetch checklists + items
    const { data: checklists } = await db
        .from('TaskChecklist')
        .select('*')
        .eq('taskId', id)
        .order('position', { ascending: true });

    const checklistIds = (checklists || []).map(c => c.id);
    let allItems: Record<string, unknown>[] = [];
    if (checklistIds.length > 0) {
        const { data } = await db
            .from('TaskChecklistItem')
            .select('*')
            .in('checklistId', checklistIds)
            .order('position', { ascending: true });
        allItems = data || [];
    }

    const itemsByChecklist: Record<string, unknown[]> = {};
    for (const item of allItems) {
        const cid = item.checklistId as string;
        if (!itemsByChecklist[cid]) itemsByChecklist[cid] = [];
        itemsByChecklist[cid].push(item);
    }

    const enrichedChecklists = (checklists || []).map(cl => ({
        ...cl,
        items: itemsByChecklist[cl.id] || [],
    }));

    // Fetch watchers
    const { data: watchers } = await db
        .from('TaskWatcher')
        .select('userId')
        .eq('taskId', id);

    const isWatching = (watchers || []).some(w => w.userId === auth.dbUser.id);

    // Assignee info
    let assignee = null;
    if (task.assigneeId) {
        const { data: user } = await db.from('User').select('id, name, avatarUrl').eq('id', task.assigneeId).maybeSingle();
        assignee = user;
    }

    // Fetch linked documents
    const { data: taskDocs } = await db
        .from('TaskDocument')
        .select('id, documentId, createdAt')
        .eq('taskId', id)
        .order('createdAt', { ascending: false });

    let documents: Record<string, unknown>[] = [];
    if (taskDocs && taskDocs.length > 0) {
        const docIds = taskDocs.map(td => td.documentId);
        const { data: docs } = await db
            .from('Document')
            .select('id, filename, mimeType, size, storageKey, ocrStatus, createdAt')
            .in('id', docIds);

        const docsMap = Object.fromEntries((docs || []).map(d => [d.id, d]));
        documents = taskDocs.map(td => ({
            linkId: td.id,
            linkedAt: td.createdAt,
            ...(docsMap[td.documentId] || { id: td.documentId, filename: 'Unknown' }),
        }));
    }

    return NextResponse.json({
        task,
        assignee,
        comments: enrichedComments,
        activity: activity || [],
        links: links || [],
        checklists: enrichedChecklists,
        documents,
        isWatching,
        watcherCount: (watchers || []).length,
    });
}

/**
 * PUT /api/tasks/[id] — Update task fields
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: task } = await db
        .from('Task')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    const changedFields: string[] = [];

    if (body.title !== undefined && body.title !== task.title) {
        updates.title = body.title.trim();
        changedFields.push('title');
    }
    if (body.description !== undefined) {
        updates.description = body.description?.trim() || null;
        changedFields.push('description');
    }
    if (body.priority !== undefined && body.priority !== task.priority) {
        updates.priority = body.priority;
        changedFields.push('priority');
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId: id,
            actorId: auth.dbUser.id,
            action: 'priority_changed',
            metadata: { from: task.priority, to: body.priority },
        });
    }
    if (body.startDate !== undefined) {
        updates.startDate = body.startDate || null;
        changedFields.push('startDate');
    }
    if (body.dueDate !== undefined) {
        updates.dueDate = body.dueDate || null;
        changedFields.push('dueDate');
    }
    if (body.isCompleted !== undefined && body.isCompleted !== task.isCompleted) {
        updates.isCompleted = body.isCompleted;
        changedFields.push('isCompleted');
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId: id,
            actorId: auth.dbUser.id,
            action: 'completed',
            metadata: { isCompleted: body.isCompleted },
        });
    }
    if (body.coverColor !== undefined) {
        updates.coverColor = body.coverColor || null;
        changedFields.push('coverColor');
    }
    if (body.coverImage !== undefined) {
        updates.coverImage = body.coverImage || null;
        changedFields.push('coverImage');
    }
    if (body.labels !== undefined) {
        updates.labels = body.labels;
        changedFields.push('labels');
    }
    if (body.assigneeId !== undefined && body.assigneeId !== task.assigneeId) {
        updates.assigneeId = body.assigneeId || null;
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId: id,
            actorId: auth.dbUser.id,
            action: 'assigned',
            metadata: { assigneeId: body.assigneeId || null },
        });
    }
    if (body.columnId !== undefined && body.columnId !== task.columnId) {
        updates.columnId = body.columnId;
    }
    if (body.isHighlighted !== undefined) {
        updates.isHighlighted = body.isHighlighted;
        changedFields.push('isHighlighted');
    }
    if (body.estimatedEffort !== undefined) {
        updates.estimatedEffort = body.estimatedEffort || null;
        changedFields.push('estimatedEffort');
    }
    if (body.aiMemberId !== undefined) {
        updates.aiMemberId = body.aiMemberId || null;
        changedFields.push('aiMemberId');
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId: id,
            actorId: auth.dbUser.id,
            action: 'delegated_to_ai',
            metadata: { aiMemberId: body.aiMemberId || null },
        });
    }

    await db.from('Task').update(updates).eq('id', id);

    if (changedFields.length > 0 && !changedFields.includes('priority') && !changedFields.includes('isCompleted')) {
        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId: id,
            actorId: auth.dbUser.id,
            action: 'updated',
            metadata: { fields: changedFields },
        });
    }

    return NextResponse.json({ success: true });
}

/**
 * DELETE /api/tasks/[id] — Delete task
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: task } = await db
        .from('Task')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    await db.from('Task').delete().eq('id', id);

    return NextResponse.json({ success: true });
}
