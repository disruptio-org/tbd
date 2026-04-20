import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { canTransitionTask, propagateTaskCompletion } from '@/lib/boardroom/status-engine';
import type { TaskStatus } from '@/lib/boardroom/constants';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/boardroom/initiatives/[id]/tasks — List tasks for an initiative
 */
export async function GET(_req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();

    // Verify initiative ownership
    const { data: initiative } = await db
        .from('Initiative')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const { data: tasks } = await db
        .from('InitiativeTask')
        .select('*')
        .eq('initiativeId', id)
        .order('position');

    return NextResponse.json({ tasks: tasks || [] });
}

/**
 * POST /api/boardroom/initiatives/[id]/tasks — Add a task to an initiative
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();

    // Verify initiative ownership
    const { data: initiative } = await db
        .from('Initiative')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const body = await req.json();
    const { title, description, workstreamId, assignedBrainType, assignedBrainId, requiredSkill, dueTarget, dependsOnTaskIds } = body;

    if (!title?.trim()) {
        return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Get next position
    const { data: maxTasks } = await db
        .from('InitiativeTask')
        .select('position')
        .eq('initiativeId', id)
        .order('position', { ascending: false })
        .limit(1);

    const nextPosition = (maxTasks && maxTasks.length > 0 ? maxTasks[0].position : -1) + 1;
    const now = new Date().toISOString();

    const taskId = crypto.randomUUID();
    const task = {
        id: taskId,
        initiativeId: id,
        workstreamId: workstreamId || null,
        title: title.trim(),
        description: description?.trim() || null,
        assignedBrainType: assignedBrainType || null,
        assignedBrainId: assignedBrainId || null,
        requiredSkill: requiredSkill || null,
        status: 'NOT_STARTED',
        position: nextPosition,
        dueTarget: dueTarget || null,
        dependsOnTaskIds: dependsOnTaskIds || [],
        updatedAt: now,
    };

    await db.from('InitiativeTask').insert(task);

    // Log event
    await db.from('InitiativeEvent').insert({
        id: crypto.randomUUID(),
        initiativeId: id,
        actorType: 'user',
        actorLabel: auth.dbUser.name || auth.dbUser.email,
        action: 'task_assigned',
        description: `Task "${title.trim()}" added`,
    });

    return NextResponse.json({ task });
}

/**
 * PUT /api/boardroom/initiatives/[id]/tasks — Update a task (body.taskId required)
 */
export async function PUT(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();

    // Verify initiative ownership
    const { data: initiative } = await db
        .from('Initiative')
        .select('id, status')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const body = await req.json();
    const { taskId, ...updates } = body;

    if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });

    // Verify task belongs to this initiative
    const { data: task } = await db
        .from('InitiativeTask')
        .select('id, status, title')
        .eq('id', taskId)
        .eq('initiativeId', id)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // Handle status transitions
    let statusChanged = false;
    let newStatus: TaskStatus | null = null;
    if (updates.status && updates.status !== task.status) {
        const from = task.status as TaskStatus;
        const to = updates.status as TaskStatus;
        if (!canTransitionTask(from, to)) {
            return NextResponse.json(
                { error: `Invalid task transition: ${from} → ${to}` },
                { status: 400 },
            );
        }

        if (to === 'VALIDATED' || to === 'OUTPUT_READY') {
            updates.deliveredAt = new Date().toISOString();
        }

        statusChanged = true;
        newStatus = to;

        // Log status change
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: to === 'VALIDATED' ? 'task_validated' : 'started',
            description: `Task "${task.title}" status: ${from} → ${to}`,
        });
    }

    const allowedFields = [
        'title', 'description', 'purpose', 'inputs', 'deliverables',
        'acceptanceCriteria', 'assignedBrainType', 'assignedBrainId',
        'selectedSkillId', 'requiredSkill', 'status', 'dueTarget',
        'outputSummary', 'dependsOnTaskIds', 'deliveredAt',
        'executionModeOverride', 'requiresApprovalBeforeRun',
        'requiresApprovalAfterRun',
    ];
    const cleanUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const field of allowedFields) {
        if (updates[field] !== undefined) cleanUpdates[field] = updates[field];
    }

    await db.from('InitiativeTask').update(cleanUpdates).eq('id', taskId);

    // ── Post-update: Propagate completion ──
    if (statusChanged && newStatus === 'VALIDATED') {
        // Unblock dependent tasks
        const unblocked = await propagateTaskCompletion(db, id);

        if (unblocked > 0) {
            await db.from('InitiativeEvent').insert({
                id: crypto.randomUUID(),
                initiativeId: id,
                actorType: 'system',
                actorLabel: 'Boardroom Engine',
                action: 'tasks_unblocked',
                description: `${unblocked} dependent task(s) unblocked after "${task.title}" completed`,
            });
        }

        // Check if ALL tasks are now done → auto-transition initiative to REVIEW_READY
        const { data: allTasks } = await db
            .from('InitiativeTask')
            .select('id, status')
            .eq('initiativeId', id);

        if (allTasks && allTasks.length > 0) {
            const allDone = allTasks.every(t =>
                t.id === taskId ? true : (t.status === 'VALIDATED' || t.status === 'CANCELLED' || t.status === 'SKIPPED')
            );

            if (allDone && initiative.status === 'IN_PROGRESS') {
                await db.from('Initiative').update({
                    status: 'REVIEW_READY',
                    updatedAt: new Date().toISOString(),
                }).eq('id', id);

                await db.from('InitiativeEvent').insert({
                    id: crypto.randomUUID(),
                    initiativeId: id,
                    actorType: 'system',
                    actorLabel: 'Boardroom Engine',
                    action: 'status_change',
                    description: 'All tasks completed — initiative moved to REVIEW_READY',
                });
            }
        }
    }

    return NextResponse.json({ success: true });
}
