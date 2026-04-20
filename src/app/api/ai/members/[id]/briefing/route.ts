import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';

/**
 * GET /api/ai/members/[id]/briefing
 * Returns a morning briefing summary for the AI member.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: memberId } = await params;
    const supabase = createAdminClient();

    // Load brain profile to get name
    const { data: brain } = await supabase
        .from('AIBrainProfile')
        .select('id, name, brainType')
        .eq('id', memberId)
        .eq('companyId', auth.companyId)
        .single();

    if (!brain) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Count tasks assigned to this member
    const { data: tasks } = await supabase
        .from('Task')
        .select('id, title, isCompleted, priority, columnId')
        .eq('companyId', auth.companyId)
        .eq('aiMemberId', memberId);

    // Count initiative tasks
    const { data: initiativeTasks } = await supabase
        .from('InitiativeTask')
        .select('id, title, status')
        .eq('assignedBrainId', memberId);

    // Count pending approvals
    const { data: pendingApprovals } = await supabase
        .from('ApprovalRequest')
        .select('id')
        .eq('status', 'PENDING')
        .in('taskId', (initiativeTasks || []).map((t: any) => t.id));

    // Calculate stats
    const allTasks = tasks || [];
    const allInitTasks = initiativeTasks || [];

    // Check which board tasks have AI-completed processing
    const boardTaskIds = allTasks.map(t => t.id);
    let aiDoneTaskIds: Set<string> = new Set();
    if (boardTaskIds.length > 0) {
        const { data: progressEntries } = await supabase
            .from('TaskActivity')
            .select('taskId, metadata')
            .in('taskId', boardTaskIds)
            .eq('action', 'ai_progress')
            .order('createdAt', { ascending: false });
        // Find tasks with latest step = 'done'
        const seen = new Set<string>();
        (progressEntries || []).forEach((entry: any) => {
            if (!seen.has(entry.taskId)) {
                seen.add(entry.taskId);
                if (entry.metadata?.step === 'done') {
                    aiDoneTaskIds.add(entry.taskId);
                }
            }
        });
    }

    const working = allTasks.filter(t => !t.isCompleted && !aiDoneTaskIds.has(t.id)).length
        + allInitTasks.filter(t => ['IN_PROGRESS', 'READY'].includes(t.status)).length;
    const needsApproval = (pendingApprovals?.length || 0)
        + allInitTasks.filter(t => t.status === 'WAITING_APPROVAL').length
        + allTasks.filter(t => !t.isCompleted && aiDoneTaskIds.has(t.id)).length;
    const blocked = allInitTasks.filter(t => ['BLOCKED', 'WAITING_DEPENDENCY'].includes(t.status)).length;
    const done = allTasks.filter(t => t.isCompleted).length
        + allInitTasks.filter(t => t.status === 'DONE').length;

    const name = brain.name.split(' ')[0];
    const total = working + needsApproval + blocked + done;

    let briefingText = '';
    if (total === 0) {
        briefingText = `Good morning. ${name} has a clear schedule — no tasks assigned yet. Assign work or start a conversation to get things moving.`;
    } else {
        const parts: string[] = [];
        if (working > 0) parts.push(`${working} item${working > 1 ? 's' : ''} in progress`);
        if (needsApproval > 0) parts.push(`${needsApproval} waiting for your approval`);
        if (blocked > 0) parts.push(`${blocked} blocked`);
        if (done > 0) parts.push(`${done} completed`);
        briefingText = `${name} is currently tracking ${total} work item${total > 1 ? 's' : ''}. ${parts.join(', ')}.`;
    }

    return NextResponse.json({
        briefingText,
        stats: { working, needsApproval, blocked, done },
    });
}
