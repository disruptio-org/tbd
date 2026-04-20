import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { canTransitionTask, propagateTaskCompletion, computeInitiativeStatusFromTasks } from '@/lib/boardroom/status-engine';
import type { TaskStatus, ExecutionMode, InitiativeStatus } from '@/lib/boardroom/constants';

type RouteContext = { params: Promise<{ id: string; taskId: string }> };

/**
 * POST /api/boardroom/initiatives/[id]/tasks/[taskId]/validate
 * Output validation endpoint. User reviews task output and decides.
 * Body: { action: 'approve' | 'revise' | 'rerun', note?: string }
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, taskId } = await ctx.params;
    const db = createAdminClient();

    // Verify initiative
    const { data: initiative } = await db
        .from('Initiative')
        .select('id, status, executionMode')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    // Fetch task
    const { data: task } = await db
        .from('InitiativeTask')
        .select('id, status, title, revisionCount')
        .eq('id', taskId)
        .eq('initiativeId', id)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const body = await req.json();
    const { action, note } = body;

    if (!action || !['approve', 'revise', 'rerun'].includes(action)) {
        return NextResponse.json({ error: 'action must be approve, revise, or rerun' }, { status: 400 });
    }

    const from = task.status as TaskStatus;
    const now = new Date().toISOString();
    const executionMode = (initiative.executionMode || 'MANUAL') as ExecutionMode;

    if (action === 'approve') {
        // OUTPUT_READY → VALIDATED
        const to: TaskStatus = 'VALIDATED';
        if (!canTransitionTask(from, to)) {
            return NextResponse.json({ error: `Cannot validate: current status is ${from}` }, { status: 400 });
        }

        await db.from('InitiativeTask').update({
            status: to,
            updatedAt: now,
        }).eq('id', taskId);

        // Log event
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: 'task_validated',
            description: `Task "${task.title}" validated${note ? ' — ' + note.trim() : ''}`,
        });

        // Propagate: unblock dependent tasks
        const unblocked = await propagateTaskCompletion(db, id, executionMode);
        if (unblocked > 0) {
            await db.from('InitiativeEvent').insert({
                id: crypto.randomUUID(),
                initiativeId: id,
                actorType: 'system',
                actorLabel: 'Boardroom Engine',
                action: 'unblocked',
                description: `${unblocked} task(s) unblocked after "${task.title}" validated`,
            });
        }

        // Check if all tasks are validated → auto-transition initiative
        const { data: allTasks } = await db
            .from('InitiativeTask')
            .select('id, status, workstreamId')
            .eq('initiativeId', id);

        if (allTasks) {
            const suggestion = computeInitiativeStatusFromTasks(
                allTasks.map(t => ({ ...t, status: t.id === taskId ? 'VALIDATED' : t.status })),
                initiative.status as InitiativeStatus,
            );
            if (suggestion && suggestion !== initiative.status) {
                await db.from('Initiative').update({
                    status: suggestion,
                    updatedAt: now,
                    ...(suggestion === 'COMPLETED' ? { completedAt: now } : {}),
                }).eq('id', id);

                await db.from('InitiativeEvent').insert({
                    id: crypto.randomUUID(),
                    initiativeId: id,
                    actorType: 'system',
                    actorLabel: 'Boardroom Engine',
                    action: suggestion === 'REVIEW_READY' ? 'completed' : 'started',
                    description: `Initiative status: ${initiative.status} → ${suggestion}`,
                });
            }
        }

        return NextResponse.json({ success: true, status: to, unblocked });

    } else if (action === 'revise') {
        // OUTPUT_READY → NEEDS_REVISION
        const to: TaskStatus = 'NEEDS_REVISION';
        if (!canTransitionTask(from, to)) {
            return NextResponse.json({ error: `Cannot request revision: current status is ${from}` }, { status: 400 });
        }

        await db.from('InitiativeTask').update({
            status: to,
            revisionCount: (task.revisionCount || 0) + 1,
            updatedAt: now,
        }).eq('id', taskId);

        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: 'revision_requested',
            description: `Revision requested for "${task.title}"${note ? ' — ' + note.trim() : ''}`,
        });

        return NextResponse.json({ success: true, status: to });

    } else {
        // rerun: OUTPUT_READY → APPROVED_TO_RUN (will be re-executed)
        const to: TaskStatus = 'APPROVED_TO_RUN';
        // Allow from NEEDS_REVISION or OUTPUT_READY
        if (from !== 'OUTPUT_READY' && from !== 'NEEDS_REVISION') {
            return NextResponse.json({ error: `Cannot rerun: current status is ${from}` }, { status: 400 });
        }

        await db.from('InitiativeTask').update({
            status: to,
            revisionCount: (task.revisionCount || 0) + 1,
            updatedAt: now,
        }).eq('id', taskId);

        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: 'revision_requested',
            description: `Re-run requested for "${task.title}"${note ? ' — ' + note.trim() : ''}`,
        });

        return NextResponse.json({ success: true, status: to });
    }
}
