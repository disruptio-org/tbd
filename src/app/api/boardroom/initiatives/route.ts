import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeInitiativeProgress } from '@/lib/boardroom/status-engine';

/**
 * GET /api/boardroom/initiatives — List all initiatives for the company
 * Query params: status, projectId, priority
 */
export async function GET(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const projectFilter = searchParams.get('projectId');
    const priorityFilter = searchParams.get('priority');

    let query = db
        .from('Initiative')
        .select('*')
        .eq('companyId', companyId)
        .order('updatedAt', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);
    if (projectFilter) query = query.eq('projectId', projectFilter);
    if (priorityFilter) query = query.eq('priority', priorityFilter);

    const { data: initiatives, error } = await query;
    if (error) {
        console.error('[boardroom] GET initiatives error:', error);
        return NextResponse.json({ error: 'Failed to fetch initiatives' }, { status: 500 });
    }

    // Enrich with task counts and progress
    const enriched = [];
    for (const init of (initiatives || [])) {
        const { data: tasks } = await db
            .from('InitiativeTask')
            .select('id, status, workstreamId')
            .eq('initiativeId', init.id);

        const taskList = tasks || [];
        const progress = computeInitiativeProgress(taskList.map(t => ({
            id: t.id,
            status: t.status,
            workstreamId: t.workstreamId,
        })));

        // Get assigned brain types for this initiative
        const { data: brainTypes } = await db
            .from('InitiativeTask')
            .select('assignedBrainType')
            .eq('initiativeId', init.id)
            .not('assignedBrainType', 'is', null);

        const uniqueBrainTypes = [...new Set((brainTypes || []).map(b => b.assignedBrainType))];

        // Get pending approval count
        const { count: pendingApprovals } = await db
            .from('ApprovalRequest')
            .select('id', { count: 'exact', head: true })
            .eq('initiativeId', init.id)
            .eq('status', 'PENDING');

        // Get project name
        let projectName = null;
        if (init.projectId) {
            const { data: project } = await db
                .from('Project')
                .select('name')
                .eq('id', init.projectId)
                .maybeSingle();
            projectName = project?.name || null;
        }

        enriched.push({
            ...init,
            taskCount: taskList.length,
            completedTaskCount: taskList.filter(t => t.status === 'VALIDATED').length,
            progress,
            teamBrainTypes: uniqueBrainTypes,
            pendingApprovals: pendingApprovals || 0,
            projectName,
        });
    }

    return NextResponse.json({ initiatives: enriched });
}

/**
 * POST /api/boardroom/initiatives — Create a new initiative
 */
export async function POST(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const {
            title, objective, businessGoal, requestedOutcome,
            workType, priority, projectId, sourceCommand,
            planSummary, confidenceScore, approvalMode,
            workstreams, tasks, approvalGates,
        } = body;

        if (!title?.trim() || !objective?.trim()) {
            return NextResponse.json(
                { error: 'title and objective are required' },
                { status: 400 },
            );
        }

        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;
        const now = new Date().toISOString();

        // Resolve projectId — enforce always-project-scoped rule
        let resolvedProjectId = projectId;
        if (!resolvedProjectId) {
            // Auto-assign to default company project
            const { data: defaultProject } = await db
                .from('Project')
                .select('id')
                .eq('companyId', companyId)
                .order('createdAt', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (defaultProject) {
                resolvedProjectId = defaultProject.id;
            } else {
                // Create a default internal project if none exists
                const projId = crypto.randomUUID();
                await db.from('Project').insert({
                    id: projId,
                    companyId,
                    name: 'General',
                    description: 'Default internal project for company-wide initiatives',
                    status: 'active',
                    updatedAt: now,
                });
                resolvedProjectId = projId;
            }
        }

        // Create initiative
        const initiativeId = crypto.randomUUID();
        const initiative = {
            id: initiativeId,
            companyId,
            projectId: resolvedProjectId,
            title: title.trim(),
            objective: objective.trim(),
            businessGoal: businessGoal?.trim() || null,
            requestedOutcome: requestedOutcome?.trim() || null,
            workType: workType || null,
            confidenceScore: confidenceScore ?? null,
            status: planSummary ? 'PLAN_IN_REVIEW' : 'PLAN_DRAFT',
            priority: priority || 'medium',
            approvalMode: approvalMode || 'MANUAL',
            sourceCommand: sourceCommand?.trim() || null,
            planSummary: planSummary?.trim() || null,
            createdById: auth.dbUser.id,
            updatedAt: now,
        };

        const { error: initError } = await db.from('Initiative').insert(initiative);
        if (initError) {
            console.error('[boardroom] Initiative insert error:', initError);
            return NextResponse.json({ error: 'Failed to create initiative' }, { status: 500 });
        }

        // Create workstreams if provided
        if (Array.isArray(workstreams) && workstreams.length > 0) {
            const wsToInsert = workstreams.map((ws: { title: string; description?: string }, idx: number) => ({
                id: crypto.randomUUID(),
                initiativeId: initiativeId,
                title: ws.title,
                description: ws.description || null,
                position: idx,
                status: 'NOT_STARTED',
                updatedAt: now,
            }));
            await db.from('InitiativeWorkstream').insert(wsToInsert);

            // Create tasks grouped by workstream
            if (Array.isArray(tasks) && tasks.length > 0) {
                const wsMap = new Map(wsToInsert.map(ws => [ws.title, ws.id]));
                const tasksToInsert = tasks.map((t: {
                    title: string; description?: string;
                    workstreamTitle?: string; assignedBrainType?: string;
                    requiredSkill?: string; dependsOnTaskIds?: string[];
                    dueTarget?: string;
                }, idx: number) => ({
                    id: crypto.randomUUID(),
                    initiativeId: initiativeId,
                    workstreamId: t.workstreamTitle ? (wsMap.get(t.workstreamTitle) || null) : null,
                    title: t.title,
                    description: t.description || null,
                    assignedBrainType: t.assignedBrainType || null,
                    requiredSkill: t.requiredSkill || null,
                    status: 'NOT_STARTED',
                    position: idx,
                    dueTarget: t.dueTarget || null,
                    dependsOnTaskIds: t.dependsOnTaskIds || [],
                    updatedAt: now,
                }));
                await db.from('InitiativeTask').insert(tasksToInsert);
            }
        }

        // Create approval gates if provided
        if (Array.isArray(approvalGates) && approvalGates.length > 0) {
            const gatesToInsert = approvalGates.map((g: {
                gateType: string; title: string; description?: string; taskId?: string;
            }) => ({
                id: crypto.randomUUID(),
                initiativeId: initiativeId,
                taskId: g.taskId || null,
                gateType: g.gateType,
                title: g.title,
                description: g.description || null,
                status: 'PENDING',
            }));
            await db.from('ApprovalRequest').insert(gatesToInsert);
        }

        // Log creation event
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: initiativeId,
            actorType: 'user',
            actorLabel: auth.dbUser.name || auth.dbUser.email,
            action: 'created',
            description: `Initiative "${title.trim()}" created`,
        });

        // If plan summary is provided, also log planning event
        if (planSummary) {
            await db.from('InitiativeEvent').insert({
                id: crypto.randomUUID(),
                initiativeId: initiativeId,
                actorType: 'ai_member',
                actorLabel: 'Company DNA',
                action: 'planned',
                description: 'Execution plan generated and awaiting approval',
            });
        }

        return NextResponse.json({ initiative: { ...initiative, id: initiativeId } });
    } catch (error) {
        console.error('[boardroom] POST initiative error:', error);
        return NextResponse.json({ error: 'Failed to create initiative' }, { status: 500 });
    }
}
