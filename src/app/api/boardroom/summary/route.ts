import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/boardroom/summary — Aggregated status counts for the Boardroom dashboard (V2)
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Get all initiatives for this company
    const { data: initiatives } = await db
        .from('Initiative')
        .select('id, status, priority, completedAt, updatedAt')
        .eq('companyId', companyId);

    const items = initiatives || [];

    const summary = {
        total: items.length,
        planDraft: items.filter(i => i.status === 'PLAN_DRAFT').length,
        planInReview: items.filter(i => i.status === 'PLAN_IN_REVIEW').length,
        planRevision: items.filter(i => i.status === 'PLAN_REVISION').length,
        planApproved: items.filter(i => i.status === 'PLAN_APPROVED').length,
        readyForExecution: items.filter(i => i.status === 'READY_FOR_EXECUTION').length,
        inProgress: items.filter(i => i.status === 'IN_PROGRESS').length,
        waitingHumanInput: items.filter(i => i.status === 'WAITING_HUMAN_INPUT').length,
        reviewReady: items.filter(i => i.status === 'REVIEW_READY').length,
        completed: items.filter(i => i.status === 'COMPLETED').length,
        cancelled: items.filter(i => i.status === 'CANCELLED').length,
    };

    // Count pending approvals
    const { count: pendingApprovals } = await db
        .from('ApprovalRequest')
        .select('id', { count: 'exact', head: true })
        .in('initiativeId', items.map(i => i.id))
        .eq('status', 'PENDING');

    // Count plan drafts
    const { count: activeDrafts } = await db
        .from('PlanDraft')
        .select('id', { count: 'exact', head: true })
        .eq('companyId', companyId)
        .in('status', ['DRAFT', 'IN_REVIEW', 'REVISION']);

    return NextResponse.json({
        summary,
        pendingApprovals: pendingApprovals || 0,
        activeDrafts: activeDrafts || 0,
    });
}
