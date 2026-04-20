import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { canTransitionTask } from '@/lib/boardroom/status-engine';
import type { TaskStatus } from '@/lib/boardroom/constants';

type RouteContext = { params: Promise<{ id: string; taskId: string }> };

/**
 * POST /api/boardroom/initiatives/[id]/tasks/[taskId]/approve-to-run
 * Pre-execution gate: user reviews task and approves it to run.
 * Transitions: READY_FOR_REVIEW → APPROVED_TO_RUN
 */
export async function POST(_req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, taskId } = await ctx.params;
    const db = createAdminClient();

    // Verify initiative
    const { data: initiative } = await db
        .from('Initiative')
        .select('id, status')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    // Fetch task
    const { data: task } = await db
        .from('InitiativeTask')
        .select('id, status, title')
        .eq('id', taskId)
        .eq('initiativeId', id)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const from = task.status as TaskStatus;
    const to: TaskStatus = 'APPROVED_TO_RUN';

    if (!canTransitionTask(from, to)) {
        return NextResponse.json(
            { error: `Cannot approve task: current status is ${from}` },
            { status: 400 },
        );
    }

    const now = new Date().toISOString();

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
        action: 'task_approved_to_run',
        description: `Task "${task.title}" approved to run`,
    });

    return NextResponse.json({ success: true, status: to });
}
