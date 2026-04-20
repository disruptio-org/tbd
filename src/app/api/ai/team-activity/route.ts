import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';

/**
 * GET /api/ai/team-activity
 * Unified activity feed aggregating all AI team member events.
 *
 * Query params:
 *   filter   — all | tasks | conversations | approvals | artifacts  (default: all)
 *   range    — 7d | 30d | 90d                                       (default: 30d)
 *   memberId — optional, scope to a single AI member
 */
export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';
    const range = searchParams.get('range') || '30d';
    const memberIdParam = searchParams.get('memberId') || null;

    // ── Compute date cutoff ──────────────────────────────
    const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const days = RANGE_DAYS[range] || 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    // ── 1. Load AI brain members scoped to company ───────
    const { data: brains } = await supabase
        .from('AIBrainProfile')
        .select('id, name, brainType, configJson')
        .eq('companyId', auth.companyId);

    const brainMap: Record<string, { name: string; brainType: string; displayName: string }> = {};
    (brains || []).forEach((b: any) => {
        const displayName = b.configJson?.identity?.displayName || b.name;
        brainMap[b.id] = { name: b.name, brainType: b.brainType, displayName };
    });
    const brainIds = Object.keys(brainMap);

    if (brainIds.length === 0) {
        return NextResponse.json({ events: [], summary: buildSummary([]) });
    }

    // If filtering to a specific member, restrict brainIds
    const targetBrainIds = memberIdParam ? brainIds.filter(id => id === memberIdParam) : brainIds;

    // ── Colour helper (matches frontend) ─────────────────
    const AVATAR_COLORS = [
        '#6366f1', '#8b5cf6', '#0891b2', '#059669', '#d97706',
        '#e11d48', '#4f46e5', '#0d9488', '#be185d', '#65a30d',
    ];
    function getColor(name: string) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }

    interface ActivityEvent {
        id: string;
        type: string;
        agentId: string;
        agentName: string;
        agentColor: string;
        title: string;
        description: string;
        projectName?: string;
        sourceType: string;
        sourceId: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
    }

    const events: ActivityEvent[] = [];

    // ── 2. Task work (board tasks assigned to AI members) ─
    if (filter === 'all' || filter === 'tasks') {
        const { data: tasks } = await supabase
            .from('Task')
            .select('id, title, description, isCompleted, priority, updatedAt, aiMemberId, executionState, columnId')
            .eq('companyId', auth.companyId)
            .in('aiMemberId', targetBrainIds)
            .gte('updatedAt', cutoff)
            .order('updatedAt', { ascending: false })
            .limit(100);

        // Load column names for status context
        const colIds = [...new Set((tasks || []).map((t: any) => t.columnId))];
        let colMap: Record<string, { name: string; isDone: boolean }> = {};
        if (colIds.length > 0) {
            const { data: cols } = await supabase
                .from('TaskBoardColumn')
                .select('id, name, isDone')
                .in('id', colIds);
            (cols || []).forEach((c: any) => { colMap[c.id] = { name: c.name, isDone: c.isDone }; });
        }

        (tasks || []).forEach((t: any) => {
            const agent = brainMap[t.aiMemberId];
            if (!agent) return;
            const col = colMap[t.columnId];
            const isDone = t.isCompleted || col?.isDone;
            const isBlocked = t.executionState === 'BLOCKED';

            let type = 'task_started';
            if (isDone) type = 'task_completed';
            else if (isBlocked) type = 'task_blocked';

            events.push({
                id: `task-${t.id}`,
                type,
                agentId: t.aiMemberId,
                agentName: agent.displayName,
                agentColor: getColor(agent.displayName),
                title: t.title,
                description: t.description || '',
                sourceType: 'board_task',
                sourceId: t.id,
                timestamp: t.updatedAt,
                metadata: { priority: t.priority, column: col?.name },
            });
        });
    }

    // ── 3. Initiative work ────────────────────────────────
    if (filter === 'all' || filter === 'tasks') {
        const { data: initTasks } = await supabase
            .from('InitiativeTask')
            .select('id, title, description, status, updatedAt, assignedBrainId, initiativeId')
            .in('assignedBrainId', targetBrainIds)
            .gte('updatedAt', cutoff)
            .order('updatedAt', { ascending: false })
            .limit(100);

        // Load initiative titles for context
        const initIds = [...new Set((initTasks || []).map((t: any) => t.initiativeId))];
        let initMap: Record<string, string> = {};
        if (initIds.length > 0) {
            const { data: inits } = await supabase
                .from('Initiative')
                .select('id, title')
                .in('id', initIds);
            (inits || []).forEach((i: any) => { initMap[i.id] = i.title; });
        }

        (initTasks || []).forEach((t: any) => {
            const agent = brainMap[t.assignedBrainId];
            if (!agent) return;

            let type = 'initiative_working';
            if (['VALIDATED', 'OUTPUT_READY'].includes(t.status)) type = 'task_completed';
            else if (t.status === 'BLOCKED') type = 'task_blocked';
            else if (['WAITING_APPROVAL', 'DELIVERED'].includes(t.status)) type = 'approval_pending';
            else if (t.status === 'RUNNING') type = 'initiative_running';

            events.push({
                id: `init-task-${t.id}`,
                type,
                agentId: t.assignedBrainId,
                agentName: agent.displayName,
                agentColor: getColor(agent.displayName),
                title: t.title,
                description: t.description || '',
                projectName: initMap[t.initiativeId],
                sourceType: 'initiative_task',
                sourceId: t.id,
                timestamp: t.updatedAt,
                metadata: { status: t.status, initiativeId: t.initiativeId },
            });
        });
    }

    // ── 4. Conversations ──────────────────────────────────
    if (filter === 'all' || filter === 'conversations') {
        const { data: sessions } = await supabase
            .from('AssistantSession')
            .select('id, brainProfileId, startedAt, status')
            .eq('companyId', auth.companyId)
            .in('brainProfileId', targetBrainIds)
            .gte('startedAt', cutoff)
            .order('startedAt', { ascending: false })
            .limit(50);

        // For each session, get the first user message as title
        for (const session of (sessions || []) as any[]) {
            const agent = brainMap[session.brainProfileId];
            if (!agent) continue;

            const { data: firstMsg } = await supabase
                .from('AssistantMessage')
                .select('content')
                .eq('sessionId', session.id)
                .eq('role', 'USER')
                .order('createdAt', { ascending: true })
                .limit(1);

            const msgPreview = firstMsg?.[0]?.content
                ? (firstMsg[0].content.length > 120 ? firstMsg[0].content.slice(0, 120) + '…' : firstMsg[0].content)
                : 'Conversation session';

            events.push({
                id: `session-${session.id}`,
                type: 'conversation',
                agentId: session.brainProfileId,
                agentName: agent.displayName,
                agentColor: getColor(agent.displayName),
                title: msgPreview,
                description: '',
                sourceType: 'session',
                sourceId: session.id,
                timestamp: session.startedAt,
                metadata: { status: session.status },
            });
        }
    }

    // ── 5. Approvals ──────────────────────────────────────
    if (filter === 'all' || filter === 'approvals') {
        // Get initiative IDs for this company
        const { data: companyInitiatives } = await supabase
            .from('Initiative')
            .select('id')
            .eq('companyId', auth.companyId);

        const companyInitIds = (companyInitiatives || []).map((i: any) => i.id);

        if (companyInitIds.length > 0) {
            const { data: approvals } = await supabase
                .from('ApprovalRequest')
                .select('id, title, description, status, createdAt, taskId, initiativeId')
                .in('initiativeId', companyInitIds)
                .gte('createdAt', cutoff)
                .order('createdAt', { ascending: false })
                .limit(50);

            // Resolve which agent owns the task
            const approvalTaskIds = (approvals || []).map((a: any) => a.taskId).filter(Boolean);
            let approvalTaskMap: Record<string, string> = {};
            if (approvalTaskIds.length > 0) {
                const { data: aTasks } = await supabase
                    .from('InitiativeTask')
                    .select('id, assignedBrainId')
                    .in('id', approvalTaskIds);
                (aTasks || []).forEach((t: any) => {
                    if (t.assignedBrainId) approvalTaskMap[t.id] = t.assignedBrainId;
                });
            }

            (approvals || []).forEach((a: any) => {
                const agentId = a.taskId ? approvalTaskMap[a.taskId] : null;
                const agent = agentId ? brainMap[agentId] : null;

                // Skip if filtering to a specific member and this isn't theirs
                if (memberIdParam && agentId !== memberIdParam) return;

                const type = a.status === 'PENDING' ? 'approval_pending'
                    : a.status === 'APPROVED' ? 'approval_approved'
                    : a.status === 'REJECTED' ? 'approval_rejected'
                    : 'approval_pending';

                events.push({
                    id: `approval-${a.id}`,
                    type,
                    agentId: agentId || 'system',
                    agentName: agent?.displayName || 'System',
                    agentColor: agent ? getColor(agent.displayName) : '#555660',
                    title: a.title,
                    description: a.description || '',
                    sourceType: 'approval',
                    sourceId: a.id,
                    timestamp: a.createdAt,
                    metadata: { status: a.status, initiativeId: a.initiativeId },
                });
            });
        }
    }

    // ── 6. Artifacts ──────────────────────────────────────
    if (filter === 'all' || filter === 'artifacts') {
        // Artifact model — generated by AI members
        const { data: artifacts } = await supabase
            .from('Artifact')
            .select('id, title, summary, artifactType, agentId, createdAt, sessionId')
            .eq('companyId', auth.companyId)
            .in('agentId', targetBrainIds)
            .gte('createdAt', cutoff)
            .order('createdAt', { ascending: false })
            .limit(50);

        (artifacts || []).forEach((a: any) => {
            const agent = brainMap[a.agentId];
            if (!agent) return;

            events.push({
                id: `artifact-${a.id}`,
                type: 'artifact_created',
                agentId: a.agentId,
                agentName: agent.displayName,
                agentColor: getColor(agent.displayName),
                title: a.title,
                description: a.summary || '',
                sourceType: 'artifact',
                sourceId: a.id,
                timestamp: a.createdAt,
                metadata: { artifactType: a.artifactType },
            });
        });

        // InitiativeArtifact — generated through boardroom initiatives
        const { data: companyInits2 } = await supabase
            .from('Initiative')
            .select('id')
            .eq('companyId', auth.companyId);

        const companyInitIds2 = (companyInits2 || []).map((i: any) => i.id);

        if (companyInitIds2.length > 0) {
            const { data: initArtifacts } = await supabase
                .from('InitiativeArtifact')
                .select('id, title, artifactType, taskId, createdAt, initiativeId')
                .in('initiativeId', companyInitIds2)
                .gte('createdAt', cutoff)
                .order('createdAt', { ascending: false })
                .limit(50);

            // Resolve task → agent
            const artTaskIds = (initArtifacts || []).map((a: any) => a.taskId).filter(Boolean);
            let artTaskAgentMap: Record<string, string> = {};
            if (artTaskIds.length > 0) {
                const { data: artTasks } = await supabase
                    .from('InitiativeTask')
                    .select('id, assignedBrainId')
                    .in('id', artTaskIds);
                (artTasks || []).forEach((t: any) => {
                    if (t.assignedBrainId) artTaskAgentMap[t.id] = t.assignedBrainId;
                });
            }

            (initArtifacts || []).forEach((a: any) => {
                const agentId = a.taskId ? artTaskAgentMap[a.taskId] : null;
                const agent = agentId ? brainMap[agentId] : null;
                if (memberIdParam && agentId !== memberIdParam) return;
                // Dedupe — skip if we already have this artifact from the Artifact table
                if (events.some(e => e.title === a.title && e.type === 'artifact_created')) return;

                events.push({
                    id: `init-artifact-${a.id}`,
                    type: 'artifact_created',
                    agentId: agentId || 'system',
                    agentName: agent?.displayName || 'System',
                    agentColor: agent ? getColor(agent.displayName) : '#555660',
                    title: a.title,
                    description: '',
                    sourceType: 'initiative_artifact',
                    sourceId: a.id,
                    timestamp: a.createdAt,
                    metadata: { artifactType: a.artifactType, initiativeId: a.initiativeId },
                });
            });
        }
    }

    // ── Sort: newest first ────────────────────────────────
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ── Build summary ─────────────────────────────────────
    const summary = buildSummary(events);

    return NextResponse.json({ events: events.slice(0, 100), summary });
}

/* ─── Summary builder ──────────────────────────────────── */

function buildSummary(events: Array<{ type: string; agentId: string; agentName: string; agentColor: string }>) {
    const total = events.length;
    const completed = events.filter(e => e.type === 'task_completed').length;
    const blocked = events.filter(e => e.type === 'task_blocked').length;
    const pendingApprovals = events.filter(e => e.type === 'approval_pending').length;
    const conversations = events.filter(e => e.type === 'conversation').length;
    const artifactsCreated = events.filter(e => e.type === 'artifact_created').length;

    // Aggregate by agent
    const agentCounts: Record<string, { agentName: string; count: number; color: string }> = {};
    events.forEach(e => {
        if (!agentCounts[e.agentId]) {
            agentCounts[e.agentId] = { agentName: e.agentName, count: 0, color: e.agentColor };
        }
        agentCounts[e.agentId].count++;
    });

    const byAgent = Object.entries(agentCounts)
        .map(([agentId, data]) => ({ agentId, ...data }))
        .sort((a, b) => b.count - a.count);

    return { total, completed, blocked, pendingApprovals, conversations, artifactsCreated, byAgent };
}
