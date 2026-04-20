import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { canTransitionInitiative, autoStartEligibleTasks } from '@/lib/boardroom/status-engine';
import type { InitiativeStatus, ExecutionMode } from '@/lib/boardroom/constants';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/boardroom/initiatives/[id] — Get initiative detail
 */
export async function GET(_req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Fetch initiative
    const { data: initiative } = await db
        .from('Initiative')
        .select('*')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!initiative) {
        return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });
    }

    // Fetch related data in parallel
    const [
        { data: workstreams },
        { data: tasks },
        { data: approvals },
        { data: artifacts },
        { data: events },
    ] = await Promise.all([
        db.from('InitiativeWorkstream').select('*').eq('initiativeId', id).order('position'),
        db.from('InitiativeTask').select('*').eq('initiativeId', id).order('position'),
        db.from('ApprovalRequest').select('*').eq('initiativeId', id).order('createdAt', { ascending: false }),
        db.from('InitiativeArtifact').select('*').eq('initiativeId', id).order('createdAt', { ascending: false }),
        db.from('InitiativeEvent').select('*').eq('initiativeId', id).order('createdAt', { ascending: false }).limit(50),
    ]);

    // Get project name
    let projectName = null;
    if (initiative.projectId) {
        const { data: project } = await db
            .from('Project')
            .select('name')
            .eq('id', initiative.projectId)
            .maybeSingle();
        projectName = project?.name || null;
    }

    // Get brain profile names for assigned tasks
    const brainIds = [...new Set((tasks || []).filter(t => t.assignedBrainId).map(t => t.assignedBrainId))];
    let brainMap: Record<string, string> = {};
    if (brainIds.length > 0) {
        const { data: brains } = await db
            .from('AIBrainProfile')
            .select('id, name, brainType, configJson')
            .in('id', brainIds);
        brainMap = Object.fromEntries((brains || []).map(b => [b.id, (b as any).configJson?.identity?.displayName || b.name]));
    }

    // Enrich tasks with brain names
    const enrichedTasks = (tasks || []).map(t => ({
        ...t,
        assignedBrainName: t.assignedBrainId ? (brainMap[t.assignedBrainId] || t.assignedBrainType || 'Unknown') : null,
    }));

    return NextResponse.json({
        initiative: { ...initiative, projectName },
        workstreams: workstreams || [],
        tasks: enrichedTasks,
        approvals: approvals || [],
        artifacts: artifacts || [],
        events: events || [],
    });
}

/**
 * PUT /api/boardroom/initiatives/[id] — Update initiative
 */
export async function PUT(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Verify ownership
    const { data: existing } = await db
        .from('Initiative')
        .select('id, status, executionMode')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!existing) {
        return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });
    }

    const body = await req.json();
    const allowedFields = [
        'title', 'objective', 'businessGoal', 'requestedOutcome',
        'workType', 'priority', 'approvalMode', 'planSummary',
        'executionMode', 'successCriteria',
    ];

    // Build update payload (only allowed fields)
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            updates[field] = body[field];
        }
    }

    // Handle status transitions
    if (body.status && body.status !== existing.status) {
        const from = existing.status as InitiativeStatus;
        const to = body.status as InitiativeStatus;
        if (!canTransitionInitiative(from, to)) {
            return NextResponse.json(
                { error: `Invalid status transition: ${from} → ${to}` },
                { status: 400 },
            );
        }
        updates.status = to;

        if (to === 'COMPLETED') {
            updates.completedAt = new Date().toISOString();
        }

        // Log status change event
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: to === 'COMPLETED' ? 'completed' : to === 'CANCELLED' ? 'cancelled' : 'started',
            description: `Status changed from ${from} to ${to}`,
        });

        // Auto-start eligible tasks when initiative begins execution
        if (to === 'IN_PROGRESS') {
            const execMode = (body.executionMode || existing.executionMode || 'MANUAL') as ExecutionMode;
            const startedCount = await autoStartEligibleTasks(db, id, execMode);
            if (startedCount > 0) {
                await db.from('InitiativeEvent').insert({
                    id: crypto.randomUUID(),
                    initiativeId: id,
                    actorType: 'system',
                    actorLabel: 'Boardroom Engine',
                    action: 'execution_started',
                    description: `${startedCount} task${startedCount !== 1 ? 's' : ''} promoted (mode: ${execMode})`,
                });
            }
        }
    }

    // Handle execution mode change mid-execution
    if (body.executionMode && body.executionMode !== existing.executionMode) {
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: 'execution_mode_changed',
            description: `Execution mode changed to ${body.executionMode}`,
        });
    }

    const { error } = await db
        .from('Initiative')
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('[boardroom] PUT initiative error:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

/**
 * DELETE /api/boardroom/initiatives/[id] — Cancel/delete initiative
 */
export async function DELETE(_req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Verify ownership
    const { data: existing } = await db
        .from('Initiative')
        .select('id, status')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!existing) {
        return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });
    }

    // Cascade delete — Prisma handles this, but with Supabase we do it manually
    await db.from('InitiativeEvent').delete().eq('initiativeId', id);
    await db.from('InitiativeArtifact').delete().eq('initiativeId', id);
    await db.from('ApprovalRequest').delete().eq('initiativeId', id);
    await db.from('InitiativeTask').delete().eq('initiativeId', id);
    await db.from('InitiativeWorkstream').delete().eq('initiativeId', id);
    await db.from('Initiative').delete().eq('id', id);

    return NextResponse.json({ success: true });
}
