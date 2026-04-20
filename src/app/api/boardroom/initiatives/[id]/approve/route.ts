import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { canTransitionInitiative, autoStartEligibleTasks } from '@/lib/boardroom/status-engine';
import type { InitiativeStatus } from '@/lib/boardroom/constants';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/boardroom/initiatives/[id]/approve — Approve/Reject/Revise an approval gate
 * Body: { approvalId, action: 'approve' | 'reject' | 'revision', note? }
 * Or for initiative-level: { action: 'approve' | 'reject' | 'revision', note? }
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Verify initiative ownership
    const { data: initiative } = await db
        .from('Initiative')
        .select('id, status')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const body = await req.json();
    const { approvalId, action, note } = body;

    if (!action || !['approve', 'reject', 'revision'].includes(action)) {
        return NextResponse.json({ error: 'action must be approve, reject, or revision' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const statusMap: Record<string, string> = {
        approve: 'APPROVED',
        reject: 'REJECTED',
        revision: 'REVISION_REQUESTED',
    };
    const newApprovalStatus = statusMap[action];

    if (approvalId) {
        // Task-level or specific approval gate
        const { data: approval } = await db
            .from('ApprovalRequest')
            .select('id, status, gateType, taskId')
            .eq('id', approvalId)
            .eq('initiativeId', id)
            .maybeSingle();

        if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });

        if (approval.status !== 'PENDING') {
            return NextResponse.json({ error: 'Approval already decided' }, { status: 400 });
        }

        await db.from('ApprovalRequest').update({
            status: newApprovalStatus,
            decidedById: auth.dbUser.id,
            decidedAt: now,
            decisionNote: note?.trim() || null,
        }).eq('id', approvalId);

        // If this is a task-level approval and it was approved, update task status
        if (approval.taskId && action === 'approve') {
            await db.from('InitiativeTask').update({
                status: 'OUTPUT_READY',
                updatedAt: now,
            }).eq('id', approval.taskId);
        }

        // If rejected, task needs revision
        if (approval.taskId && action === 'reject') {
            await db.from('InitiativeTask').update({
                status: 'NEEDS_REVISION',
                updatedAt: now,
            }).eq('id', approval.taskId);
        }

        // Log event
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revision_requested',
            description: `${approval.gateType} gate: ${action}${note ? ' — ' + note.trim() : ''}`,
        });

        return NextResponse.json({ success: true, approvalStatus: newApprovalStatus });
    }

    // Initiative-level approval (plan approval)
    if (initiative.status !== 'PLAN_IN_REVIEW') {
        return NextResponse.json(
            { error: `Initiative is not awaiting approval (current: ${initiative.status})` },
            { status: 400 },
        );
    }

    const initiativeTargetStatus: InitiativeStatus = action === 'approve'
        ? 'PLAN_APPROVED'
        : action === 'reject'
        ? 'CANCELLED'
        : 'PLAN_REVISION';

    if (!canTransitionInitiative(initiative.status as InitiativeStatus, initiativeTargetStatus)) {
        return NextResponse.json({ error: 'Invalid transition' }, { status: 400 });
    }

    await db.from('Initiative').update({
        status: initiativeTargetStatus,
        updatedAt: now,
    }).eq('id', id);

    // Update the plan_approval gate if it exists
    const { data: planGate } = await db
        .from('ApprovalRequest')
        .select('id')
        .eq('initiativeId', id)
        .eq('gateType', 'plan_approval')
        .eq('status', 'PENDING')
        .maybeSingle();

    if (planGate) {
        await db.from('ApprovalRequest').update({
            status: newApprovalStatus,
            decidedById: auth.dbUser.id,
            decidedAt: now,
            decisionNote: note?.trim() || null,
        }).eq('id', planGate.id);
    }

    // Log event
    await db.from('InitiativeEvent').insert({
        id: crypto.randomUUID(),
        initiativeId: id,
        actorType: 'user',
        actorLabel: auth.dbUser.name || auth.dbUser.email,
        action: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revision_requested',
        description: `Initiative plan ${action}${note ? ' — ' + note.trim() : ''}`,
    });

    // When plan is approved, auto-transition to IN_PROGRESS and start eligible tasks
    if (action === 'approve') {
        await db.from('Initiative').update({
            status: 'IN_PROGRESS',
            updatedAt: now,
        }).eq('id', id);

        const startedCount = await autoStartEligibleTasks(db, id);

        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'system',
            actorLabel: 'Boardroom Engine',
            action: 'execution_started',
            description: `Execution started automatically. ${startedCount} task${startedCount !== 1 ? 's' : ''} kicked off.`,
        });
    }

    return NextResponse.json({ success: true, initiativeStatus: action === 'approve' ? 'IN_PROGRESS' : initiativeTargetStatus });
}
