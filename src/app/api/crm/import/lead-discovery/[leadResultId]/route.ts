import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/crm/import/lead-discovery/[leadResultId]
 * Creates a CRM lead from an existing LeadResult
 */
export async function POST(_req: Request, { params }: { params: Promise<{ leadResultId: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadResultId } = await params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;
    const userId = auth.dbUser.id;

    try {
        // Fetch the LeadResult
        const { data: leadResult, error: lrError } = await db
            .from('LeadResult')
            .select('*')
            .eq('id', leadResultId)
            .eq('companyId', companyId)
            .maybeSingle();

        if (lrError || !leadResult) {
            return NextResponse.json({ error: 'Lead result not found' }, { status: 404 });
        }

        // Check if already imported
        const { data: alreadyImported } = await db
            .from('CrmLead')
            .select('id')
            .eq('companyId', companyId)
            .eq('sourceType', 'LEAD_DISCOVERY')
            .eq('sourceReference', leadResultId)
            .maybeSingle();

        if (alreadyImported) {
            return NextResponse.json({ error: 'This lead has already been imported to CRM', existingLeadId: alreadyImported.id }, { status: 409 });
        }

        // Get default pipeline stage
        let defaultStageId: string | null = null;
        const { data: defaultStage } = await db
            .from('CrmPipelineStage')
            .select('id')
            .eq('companyId', companyId)
            .eq('isDefault', true)
            .eq('isArchived', false)
            .maybeSingle();

        if (defaultStage) {
            defaultStageId = defaultStage.id;
        } else {
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
            defaultStageId = firstStage.id;
        }

        const now = new Date().toISOString();
        const leadId = crypto.randomUUID();

        // Build notes from LeadResult fields
        const notesParts: string[] = [];
        if (leadResult.summary) notesParts.push(`**Summary:** ${leadResult.summary}`);
        if (leadResult.whyFit) notesParts.push(`**Why They Fit:** ${leadResult.whyFit}`);
        if (leadResult.suggestedApproach) notesParts.push(`**Suggested Approach:** ${leadResult.suggestedApproach}`);

        // Extract first contact role if available
        let contactJobTitle: string | null = null;
        if (leadResult.likelyContactRoles && Array.isArray(leadResult.likelyContactRoles) && leadResult.likelyContactRoles.length > 0) {
            contactJobTitle = leadResult.likelyContactRoles[0];
        }

        const { data: lead, error: createError } = await db
            .from('CrmLead')
            .insert({
                id: leadId,
                companyId,
                createdByUserId: userId,
                ownerUserId: userId,
                pipelineStageId: defaultStageId,
                sourceType: 'LEAD_DISCOVERY',
                sourceReference: leadResultId,
                leadName: leadResult.companyName || 'Imported Lead',
                companyName: leadResult.companyName || null,
                website: leadResult.website || null,
                industry: leadResult.industry || null,
                location: leadResult.location || null,
                jobTitle: contactJobTitle,
                notes: notesParts.join('\n\n') || null,
                lastActivityAt: now,
                updatedAt: now,
            })
            .select()
            .single();

        if (createError) {
            console.error('[CRM Import] Error:', createError);
            return NextResponse.json({ error: 'Failed to import lead' }, { status: 500 });
        }

        // Log import activity
        await db.from('CrmLeadActivity').insert({
            id: crypto.randomUUID(),
            crmLeadId: leadId,
            actorId: userId,
            action: 'imported',
            content: `Imported from Lead Discovery`,
            metadata: { sourceLeadResultId: leadResultId, sourceSearchRunId: leadResult.searchRunId },
        });

        return NextResponse.json({ lead, message: 'Lead imported to CRM successfully' }, { status: 201 });
    } catch (err) {
        console.error('[CRM Import] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
