import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { autoStartEligibleTasks } from '@/lib/boardroom/status-engine';
import type { ExecutionMode } from '@/lib/boardroom/constants';

type RouteContext = { params: Promise<{ draftId: string }> };

/**
 * POST /api/boardroom/plan-drafts/[draftId]/approve
 * Locks the plan and creates the real Initiative + Workstreams + Tasks + Approvals.
 * Body: { executionMode: 'AUTO_CHAIN' | 'MANUAL' }
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { draftId } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Load draft
    const { data: draft } = await db
        .from('PlanDraft')
        .select('*')
        .eq('id', draftId)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status === 'APPROVED' || draft.status === 'DISCARDED') {
        return NextResponse.json({ error: 'Draft already finalized' }, { status: 400 });
    }

    const body = await req.json();
    const executionMode: ExecutionMode = body.executionMode === 'AUTO_CHAIN' ? 'AUTO_CHAIN' : 'MANUAL';
    const now = new Date().toISOString();

    // Resolve project
    let projectId = draft.projectId;
    if (!projectId) {
        const { data: defaultProject } = await db
            .from('Project')
            .select('id')
            .eq('companyId', companyId)
            .order('createdAt', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (defaultProject) {
            projectId = defaultProject.id;
        } else {
            const projId = crypto.randomUUID();
            await db.from('Project').insert({
                id: projId,
                companyId,
                name: 'General',
                description: 'Default project for company-wide initiatives',
                status: 'active',
                updatedAt: now,
            });
            projectId = projId;
        }
    }

    // Create Initiative
    const initiativeId = crypto.randomUUID();
    const initiative = {
        id: initiativeId,
        companyId,
        projectId,
        planDraftId: draftId,
        title: draft.title,
        objective: draft.objective,
        businessGoal: draft.businessGoal || null,
        requestedOutcome: draft.requestedOutcome || null,
        successCriteria: draft.successCriteria || null,
        workType: draft.workType || null,
        confidenceScore: draft.confidenceScore ?? null,
        status: 'READY_FOR_EXECUTION',
        priority: 'medium',
        executionMode,
        approvalMode: 'MANUAL',
        sourceCommand: draft.command || null,
        planSummary: draft.planSummary || null,
        createdById: auth.dbUser.id,
        updatedAt: now,
    };

    const { error: initError } = await db.from('Initiative').insert(initiative);
    if (initError) {
        console.error('[plan-drafts/approve] Initiative insert error:', initError);
        return NextResponse.json({ error: 'Failed to create initiative' }, { status: 500 });
    }

    // Create Workstreams
    const workstreams = Array.isArray(draft.workstreams) ? draft.workstreams : [];
    const wsInserts: { id: string; initiativeId: string; title: string; description: string | null; position: number; status: string; updatedAt: string }[] = workstreams.map((ws: { title: string; description?: string }, idx: number) => ({
        id: crypto.randomUUID(),
        initiativeId,
        title: ws.title,
        description: ws.description || null,
        position: idx,
        status: 'NOT_STARTED',
        updatedAt: now,
    }));
    if (wsInserts.length > 0) {
        await db.from('InitiativeWorkstream').insert(wsInserts);
    }
    const wsMap = new Map<string, string>(wsInserts.map(ws => [ws.title, ws.id]));

    // Create Tasks with rich spec
    const tasks = Array.isArray(draft.tasks) ? draft.tasks : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskInserts = tasks.map((t: any, idx: number) => ({
        id: crypto.randomUUID(),
        initiativeId,
        workstreamId: t.workstreamTitle ? (wsMap.get(t.workstreamTitle) || null) : null,
        title: t.title || `Task ${idx + 1}`,
        description: t.description || null,
        purpose: t.purpose || null,
        inputs: t.inputs || null,
        deliverables: t.deliverables || null,
        acceptanceCriteria: t.acceptanceCriteria || null,
        assignedBrainType: t.assignedBrainType || null,
        assignedBrainId: t.assignedMemberId || null,
        selectedSkillId: t.selectedSkillId || null,
        requiredSkill: t.selectedSkillName || null,
        status: 'PLANNED',
        position: idx,
        dueTarget: t.dueTarget || null,
        dependsOnTaskIds: [], // resolved below
        executionModeOverride: t.executionModeOverride || null,
        requiresApprovalBeforeRun: t.requiresApprovalBeforeRun ?? true,
        requiresApprovalAfterRun: t.requiresApprovalAfterRun ?? true,
        revisionCount: 0,
        updatedAt: now,
    }));

    // Resolve cross-task dependencies by title → ID
    const taskTitleToId = new Map(taskInserts.map((t: { title: string; id: string }) => [t.title, t.id]));
    for (let i = 0; i < tasks.length; i++) {
        const depTitles = tasks[i].dependsOnTaskTitles || [];
        taskInserts[i].dependsOnTaskIds = depTitles
            .map((title: string) => taskTitleToId.get(title))
            .filter((id: string | undefined) => id !== undefined);
    }

    if (taskInserts.length > 0) {
        await db.from('InitiativeTask').insert(taskInserts);
    }

    // Create Approval Gates
    const gates = Array.isArray(draft.approvalGates) ? draft.approvalGates : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gateInserts = gates.map((g: any) => ({
        id: crypto.randomUUID(),
        initiativeId,
        taskId: g.taskTitle ? (taskTitleToId.get(g.taskTitle) || null) : null,
        gateType: g.gateType || 'custom',
        title: g.title || 'Approval',
        description: g.description || null,
        status: 'PENDING',
    }));
    if (gateInserts.length > 0) {
        await db.from('ApprovalRequest').insert(gateInserts);
    }

    // Log events
    await db.from('InitiativeEvent').insert([
        {
            id: crypto.randomUUID(),
            initiativeId,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: 'created',
            description: `Initiative "${draft.title}" created from approved plan`,
        },
        {
            id: crypto.randomUUID(),
            initiativeId,
            actorType: 'system',
            actorLabel: 'Boardroom Engine',
            action: 'planned',
            description: `Plan approved. Execution mode: ${executionMode}. ${taskInserts.length} tasks, ${wsInserts.length} workstreams.`,
        },
    ]);

    // Mark draft as APPROVED
    await db.from('PlanDraft').update({
        status: 'APPROVED',
        executionMode,
        updatedAt: now,
    }).eq('id', draftId);

    // Transition to IN_PROGRESS and start eligible tasks
    await db.from('Initiative').update({
        status: 'IN_PROGRESS',
        updatedAt: now,
    }).eq('id', initiativeId);

    const startedCount = await autoStartEligibleTasks(db, initiativeId, executionMode);

    if (startedCount > 0) {
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId,
            actorType: 'system',
            actorLabel: 'Boardroom Engine',
            action: 'execution_started',
            description: `${startedCount} task${startedCount !== 1 ? 's' : ''} promoted to ${executionMode === 'AUTO_CHAIN' ? 'auto-run queue' : 'review queue'}.`,
        });
    }

    return NextResponse.json({
        initiativeId,
        executionMode,
        tasksCreated: taskInserts.length,
        tasksStarted: startedCount,
    });
}
