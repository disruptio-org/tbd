import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/apiKeyAuth';
import { createAdminClient } from '@/lib/supabase/admin';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

/**
 * OPTIONS /api/public/crm/leads — CORS preflight
 */
export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/public/crm/leads — Create a CRM lead via API key
 *
 * Headers:
 *   x-api-key: nk_<hex>
 *
 * Body:
 *   { leadName, email?, phone?, companyName?, jobTitle?, website?,
 *     industry?, location?, notes?, tags?, sourceType?, metadata? }
 *
 * Returns: { lead: { id, leadName, email, ... } }
 */
export async function POST(req: Request) {
    // Authenticate
    const auth = await authenticateApiKey(req, 'crm:leads:write');
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS_HEADERS });
    }

    try {
        const body = await req.json();
        const { leadName, companyName, email, phone, jobTitle, website, industry, location, notes, tags, sourceType, metadata } = body;

        if (!leadName?.trim()) {
            return NextResponse.json({ error: 'leadName is required' }, { status: 400, headers: CORS_HEADERS });
        }

        const db = createAdminClient();
        const companyId = auth.companyId;

        // Validate sourceType enum — store original value in sourceReference if non-standard
        const VALID_SOURCE_TYPES = ['MANUAL', 'LEAD_DISCOVERY', 'API', 'IMPORT'];
        const rawSource = sourceType?.toUpperCase() || 'API';
        const resolvedSourceType = VALID_SOURCE_TYPES.includes(rawSource) ? rawSource : 'API';

        // Get default pipeline stage
        let stageId: string | null = null;
        const { data: defaultStage } = await db
            .from('CrmPipelineStage')
            .select('id')
            .eq('companyId', companyId)
            .eq('isDefault', true)
            .eq('isArchived', false)
            .maybeSingle();

        if (defaultStage) {
            stageId = defaultStage.id;
        } else {
            const { data: firstStage } = await db
                .from('CrmPipelineStage')
                .select('id')
                .eq('companyId', companyId)
                .eq('isArchived', false)
                .order('position', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (firstStage) stageId = firstStage.id;
        }

        if (!stageId) {
            return NextResponse.json(
                { error: 'No CRM pipeline stages configured for this company. Set up your pipeline first.' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const now = new Date().toISOString();
        const leadId = crypto.randomUUID();

        // Get a user to attribute as creator (first admin or first user of this company)
        const { data: companyUser } = await db
            .from('User')
            .select('id')
            .eq('companyId', companyId)
            .order('createdAt', { ascending: true })
            .limit(1)
            .maybeSingle();

        const { data: lead, error } = await db
            .from('CrmLead')
            .insert({
                id: leadId,
                companyId,
                createdByUserId: companyUser?.id || null,
                pipelineStageId: stageId,
                sourceType: resolvedSourceType,
                sourceReference: `api_key:${auth.keyId}${rawSource !== resolvedSourceType ? ` | original_source:${rawSource}` : ''}`,
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
            .select('id, leadName, email, phone, companyName, sourceType, createdAt')
            .single();

        if (error) {
            console.error('[public/crm/leads] Insert error:', error);
            return NextResponse.json({ error: 'Failed to create lead' }, { status: 500, headers: CORS_HEADERS });
        }

        // Log activity (API-created)
        try {
            await db.from('CrmLeadActivity').insert({
                id: crypto.randomUUID(),
                crmLeadId: leadId,
                action: 'created',
                content: `Lead "${leadName}" created via API`,
            });
        } catch { /* non-critical */ }

        return NextResponse.json({ lead }, { status: 201, headers: CORS_HEADERS });

    } catch (err) {
        console.error('[public/crm/leads] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
    }
}
