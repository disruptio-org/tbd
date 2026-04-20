import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/boardroom/plan-drafts — List plan drafts for the company
 * Query params: status
 */
export async function GET(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    let query = db
        .from('PlanDraft')
        .select('*')
        .eq('companyId', companyId)
        .order('updatedAt', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data: drafts, error } = await query;
    if (error) {
        console.error('[boardroom/plan-drafts] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    return NextResponse.json({ drafts: drafts || [] });
}

/**
 * POST /api/boardroom/plan-drafts — Create a plan draft manually
 */
export async function POST(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;
        const now = new Date().toISOString();

        const draftId = crypto.randomUUID();
        const draft = {
            id: draftId,
            companyId,
            projectId: body.projectId || null,
            command: body.command || '',
            title: body.title || 'Untitled Plan',
            objective: body.objective || '',
            successCriteria: body.successCriteria || null,
            businessGoal: body.businessGoal || null,
            requestedOutcome: body.requestedOutcome || null,
            workType: body.workType || null,
            confidenceScore: body.confidenceScore ?? null,
            planSummary: body.planSummary || null,
            workstreams: body.workstreams || [],
            tasks: body.tasks || [],
            approvalGates: body.approvalGates || [],
            executionMode: body.executionMode || 'MANUAL',
            status: 'DRAFT',
            version: 1,
            createdById: auth.dbUser.id,
            updatedAt: now,
        };

        const { error } = await db.from('PlanDraft').insert(draft);
        if (error) {
            console.error('[boardroom/plan-drafts] POST error:', error);
            return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
        }

        // Save initial version snapshot
        await db.from('PlanDraftVersion').insert({
            id: crypto.randomUUID(),
            planDraftId: draftId,
            version: 1,
            snapshot: draft,
            changeNote: 'Initial plan created',
        });

        return NextResponse.json({ draft: { ...draft, id: draftId } });
    } catch (error) {
        console.error('[boardroom/plan-drafts] POST error:', error);
        return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
    }
}
