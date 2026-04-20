import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';

/**
 * GET /api/ai/members/[id]/tasks
 * Returns unified AIWorkItem list merging Task + InitiativeTask.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: memberId } = await params;
    const supabase = createAdminClient();

    // 1. Board tasks assigned to this AI member
    const { data: boardTasks } = await supabase
        .from('Task')
        .select('id, title, description, isCompleted, priority, updatedAt, columnId')
        .eq('companyId', auth.companyId)
        .eq('aiMemberId', memberId)
        .order('updatedAt', { ascending: false })
        .limit(50);

    // Load column names for status mapping
    const columnIds = [...new Set((boardTasks || []).map((t: any) => t.columnId))];
    let columnMap: Record<string, { name: string; isDone: boolean }> = {};
    if (columnIds.length > 0) {
        const { data: columns } = await supabase
            .from('TaskBoardColumn')
            .select('id, name, isDone')
            .in('id', columnIds);
        (columns || []).forEach((c: any) => {
            columnMap[c.id] = { name: c.name, isDone: c.isDone };
        });
    }

    // 2. Initiative tasks assigned to this AI member
    const { data: initiativeTasks } = await supabase
        .from('InitiativeTask')
        .select('id, title, description, status, updatedAt')
        .eq('assignedBrainId', memberId)
        .order('updatedAt', { ascending: false })
        .limit(50);

    // 3. Normalize into AIWorkItem format
    type WorkItemStatus = 'working' | 'needs_approval' | 'blocked' | 'done';

    interface AIWorkItem {
        id: string;
        title: string;
        status: WorkItemStatus;
        sourceType: 'task' | 'initiative';
        sourceId: string;
        requiresApproval: boolean;
        updatedAt: string;
        description?: string;
        progressStep?: string;
    }

    const items: AIWorkItem[] = [];

    // Map board tasks
    (boardTasks || []).forEach((t: any) => {
        const col = columnMap[t.columnId];
        let status: WorkItemStatus = 'working';
        if (t.isCompleted || col?.isDone) status = 'done';

        items.push({
            id: t.id,
            title: t.title,
            status,
            sourceType: 'task',
            sourceId: t.id,
            requiresApproval: false,
            updatedAt: t.updatedAt,
            description: t.description || undefined,
        });
    });

    // Fetch latest ai_progress activity for board tasks
    const boardTaskIds = (boardTasks || []).map((t: any) => t.id);
    let progressMap: Record<string, string> = {};
    if (boardTaskIds.length > 0) {
        const { data: progressEntries } = await supabase
            .from('TaskActivity')
            .select('taskId, metadata, createdAt')
            .in('taskId', boardTaskIds)
            .eq('action', 'ai_progress')
            .order('createdAt', { ascending: false });
        // Take the latest per task
        (progressEntries || []).forEach((entry: any) => {
            if (!progressMap[entry.taskId] && entry.metadata?.step) {
                progressMap[entry.taskId] = entry.metadata.step;
            }
        });
    }

    // Attach progressStep to board task items
    items.forEach(item => {
        if (item.sourceType === 'task' && progressMap[item.id]) {
            item.progressStep = progressMap[item.id];
            // If step is 'done', mark as needs_approval
            if (progressMap[item.id] === 'done' && item.status === 'working') {
                item.status = 'needs_approval';
                item.requiresApproval = true;
            }
        }
    });

    // Map initiative tasks
    const INIT_STATUS_MAP: Record<string, WorkItemStatus> = {
        'NOT_STARTED': 'working',
        'READY': 'working',
        'IN_PROGRESS': 'working',
        'WAITING_DEPENDENCY': 'blocked',
        'WAITING_APPROVAL': 'needs_approval',
        'DELIVERED': 'needs_approval',
        'NEEDS_REVISION': 'working',
        'DONE': 'done',
        'CANCELLED': 'done',
        'BLOCKED': 'blocked',
    };

    (initiativeTasks || []).forEach((t: any) => {
        items.push({
            id: t.id,
            title: t.title,
            status: INIT_STATUS_MAP[t.status] || 'working',
            sourceType: 'initiative',
            sourceId: t.id,
            requiresApproval: ['WAITING_APPROVAL', 'DELIVERED'].includes(t.status),
            updatedAt: t.updatedAt,
            description: t.description || undefined,
        });
    });

    // Sort: blocked first, then needs_approval, then working, then done
    const ORDER: Record<WorkItemStatus, number> = { blocked: 0, needs_approval: 1, working: 2, done: 3 };
    items.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

    return NextResponse.json({ items });
}
