import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/crm/leads — Paginated lead list with filters
 */
export async function GET(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Filters
    const search = searchParams.get('search')?.trim();
    const stageId = searchParams.get('stageId');
    const ownerUserId = searchParams.get('ownerUserId');
    const sourceType = searchParams.get('sourceType');
    const lifecycleStatus = searchParams.get('lifecycleStatus') || 'ACTIVE';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? true : false;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25')));

    let query = db
        .from('CrmLead')
        .select('*, pipelineStage:CrmPipelineStage(id, name, color, position), owner:User!CrmLead_ownerUserId_fkey(id, name, email, avatarUrl)', { count: 'exact' })
        .eq('companyId', companyId);

    // Apply filters
    if (lifecycleStatus && lifecycleStatus !== 'ALL') {
        query = query.eq('lifecycleStatus', lifecycleStatus);
    }
    if (stageId) query = query.eq('pipelineStageId', stageId);
    if (ownerUserId) query = query.eq('ownerUserId', ownerUserId);
    if (sourceType) query = query.eq('sourceType', sourceType);
    if (search) {
        query = query.or(`leadName.ilike.%${search}%,companyName.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: leads, count, error } = await query
        .order(sortBy, { ascending: sortOrder })
        .range(from, to);

    if (error) {
        console.error('[CRM Leads GET] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    return NextResponse.json({
        leads: leads || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
    });
}

/**
 * POST /api/crm/leads — Create a new lead
 */
export async function POST(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;
        const userId = auth.dbUser.id;

        const { leadName, companyName, email, phone, jobTitle, website, industry, location, pipelineStageId, ownerUserId, notes, tags, sourceType } = body;

        if (!leadName?.trim()) {
            return NextResponse.json({ error: 'leadName is required' }, { status: 400 });
        }

        // If no stage provided, use the default one
        let stageId = pipelineStageId;
        if (!stageId) {
            const { data: defaultStage } = await db
                .from('CrmPipelineStage')
                .select('id')
                .eq('companyId', companyId)
                .eq('isDefault', true)
                .eq('isArchived', false)
                .maybeSingle();

            if (!defaultStage) {
                // Fallback: get the first stage by position
                const { data: firstStage } = await db
                    .from('CrmPipelineStage')
                    .select('id')
                    .eq('companyId', companyId)
                    .eq('isArchived', false)
                    .order('position', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                if (!firstStage) {
                    return NextResponse.json({ error: 'No pipeline stages configured. Please set up your CRM pipeline first.' }, { status: 400 });
                }
                stageId = firstStage.id;
            } else {
                stageId = defaultStage.id;
            }
        }

        const now = new Date().toISOString();
        const leadId = crypto.randomUUID();

        const { data: lead, error } = await db
            .from('CrmLead')
            .insert({
                id: leadId,
                companyId,
                createdByUserId: userId,
                ownerUserId: ownerUserId || userId,
                pipelineStageId: stageId,
                sourceType: sourceType || 'MANUAL',
                leadName: leadName.trim(),
                companyName: companyName?.trim() || null,
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                jobTitle: jobTitle?.trim() || null,
                website: website?.trim() || null,
                industry: industry?.trim() || null,
                location: location?.trim() || null,
                notes: notes?.trim() || null,
                tags: tags || null,
                lastActivityAt: now,
                updatedAt: now,
            })
            .select()
            .single();

        if (error) {
            console.error('[CRM Leads POST] Error:', error);
            return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
        }

        // Log creation activity
        await db.from('CrmLeadActivity').insert({
            id: crypto.randomUUID(),
            crmLeadId: leadId,
            actorId: userId,
            action: 'created',
            content: `Lead "${leadName}" created`,
        });

        return NextResponse.json({ lead }, { status: 201 });
    } catch (err) {
        console.error('[CRM Leads POST] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
