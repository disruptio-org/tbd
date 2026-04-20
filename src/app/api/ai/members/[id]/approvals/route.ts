import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';

/**
 * GET /api/ai/members/[id]/approvals
 * Returns pending approval items for this AI member.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: memberId } = await params;
    const supabase = createAdminClient();

    // Approach 1: Pull from InitiativeTask → ApprovalRequest
    const { data: initiativeTasks } = await supabase
        .from('InitiativeTask')
        .select('id, title, description')
        .eq('assignedBrainId', memberId)
        .in('status', ['WAITING_APPROVAL', 'DELIVERED']);

    const taskIds = (initiativeTasks || []).map((t: any) => t.id);

    let items: Array<{ id: string; title: string; description: string; status: string; sourceType: string }> = [];

    if (taskIds.length > 0) {
        const { data: approvalRequests } = await supabase
            .from('ApprovalRequest')
            .select('id, title, description, status, taskId')
            .in('taskId', taskIds)
            .eq('status', 'PENDING');

        items = (approvalRequests || []).map((ar: any) => ({
            id: ar.id,
            title: ar.title,
            description: ar.description || '',
            status: 'waiting',
            sourceType: 'initiative',
        }));
    }

    // Approach 2: Pull from AssistantActionRun with WAITING_CONFIRMATION
    const { data: sessions } = await supabase
        .from('AssistantSession')
        .select('id')
        .eq('brainProfileId', memberId)
        .eq('companyId', auth.companyId);

    const sessionIds = (sessions || []).map((s: any) => s.id);

    if (sessionIds.length > 0) {
        const { data: actionRuns } = await supabase
            .from('AssistantActionRun')
            .select('id, targetAction, requestPayloadJson, status')
            .in('sessionId', sessionIds)
            .eq('status', 'WAITING_CONFIRMATION');

        const actionItems = (actionRuns || []).map((ar: any) => ({
            id: ar.id,
            title: ar.targetAction || 'Pending Action',
            description: typeof ar.requestPayloadJson === 'object'
                ? (ar.requestPayloadJson?.title || ar.requestPayloadJson?.message || '')
                : '',
            status: 'waiting',
            sourceType: 'action',
        }));

        items = [...items, ...actionItems];
    }

    return NextResponse.json({ items });
}

/**
 * PATCH /api/ai/members/[id]/approvals
 * Approve or reject an approval item.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { approvalId, action, note } = await req.json();

    if (!approvalId || !['approve', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'approvalId and action (approve|reject) required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Try ApprovalRequest first
    const { data: ar } = await supabase
        .from('ApprovalRequest')
        .select('id')
        .eq('id', approvalId)
        .single();

    if (ar) {
        await supabase
            .from('ApprovalRequest')
            .update({
                status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                decidedById: auth.userId,
                decidedAt: new Date().toISOString(),
                decisionNote: note || null,
            })
            .eq('id', approvalId);

        return NextResponse.json({ success: true, status: action === 'approve' ? 'APPROVED' : 'REJECTED' });
    }

    // Try AssistantActionRun
    const { data: actionRun } = await supabase
        .from('AssistantActionRun')
        .select('id')
        .eq('id', approvalId)
        .single();

    if (actionRun) {
        await supabase
            .from('AssistantActionRun')
            .update({
                status: action === 'approve' ? 'RUNNING' : 'FAILED',
            })
            .eq('id', approvalId);

        return NextResponse.json({ success: true, status: action === 'approve' ? 'RUNNING' : 'FAILED' });
    }

    return NextResponse.json({ error: 'Approval item not found' }, { status: 404 });
}
