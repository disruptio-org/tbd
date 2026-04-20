import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ draftId: string }> };

/**
 * GET /api/boardroom/plan-drafts/[draftId] — Load full draft
 */
export async function GET(_req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { draftId } = await ctx.params;
    const db = createAdminClient();

    const { data: draft } = await db
        .from('PlanDraft')
        .select('*')
        .eq('id', draftId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    // Fetch version history
    const { data: versions } = await db
        .from('PlanDraftVersion')
        .select('id, version, changeNote, createdAt')
        .eq('planDraftId', draftId)
        .order('version', { ascending: false });

    return NextResponse.json({ draft, versions: versions || [] });
}

/**
 * PUT /api/boardroom/plan-drafts/[draftId] — Update draft (edit tasks, members, skills, etc.)
 */
export async function PUT(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { draftId } = await ctx.params;
    const db = createAdminClient();

    const { data: existing } = await db
        .from('PlanDraft')
        .select('id, status, version')
        .eq('id', draftId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (existing.status === 'APPROVED' || existing.status === 'DISCARDED') {
        return NextResponse.json({ error: 'Cannot edit a locked draft' }, { status: 400 });
    }

    const body = await req.json();
    const now = new Date().toISOString();
    const newVersion = existing.version + 1;

    const allowedFields = [
        'title', 'objective', 'successCriteria', 'businessGoal', 'requestedOutcome',
        'workType', 'planSummary', 'workstreams', 'tasks', 'approvalGates',
        'executionMode', 'confidenceScore',
    ];

    const updates: Record<string, unknown> = {
        updatedAt: now,
        version: newVersion,
        status: existing.status === 'DRAFT' ? 'IN_REVIEW' : existing.status,
    };

    for (const field of allowedFields) {
        if (body[field] !== undefined) updates[field] = body[field];
    }

    const { error } = await db.from('PlanDraft').update(updates).eq('id', draftId);
    if (error) {
        console.error('[boardroom/plan-drafts] PUT error:', error);
        return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
    }

    // Save version snapshot
    const { data: fullDraft } = await db.from('PlanDraft').select('*').eq('id', draftId).single();
    await db.from('PlanDraftVersion').insert({
        id: crypto.randomUUID(),
        planDraftId: draftId,
        version: newVersion,
        snapshot: fullDraft,
        changeNote: body._changeNote || 'Plan edited',
    });

    return NextResponse.json({ draft: fullDraft, version: newVersion });
}

/**
 * DELETE /api/boardroom/plan-drafts/[draftId] — Discard draft
 */
export async function DELETE(_req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { draftId } = await ctx.params;
    const db = createAdminClient();

    const { data: existing } = await db
        .from('PlanDraft')
        .select('id')
        .eq('id', draftId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    await db.from('PlanDraft').update({
        status: 'DISCARDED',
        updatedAt: new Date().toISOString(),
    }).eq('id', draftId);

    return NextResponse.json({ success: true });
}
