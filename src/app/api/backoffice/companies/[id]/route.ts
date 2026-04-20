import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/backoffice/companies/[id]
 * Get full company details with users, features, license.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        const { data: company, error: dbErr } = await db
            .from('Company')
            .select('*, User(id, name, email, role, authProvider, createdAt), CompanyFeature(id, featureKey, enabled, updatedAt), License(*)')
            .eq('id', id)
            .single();

        if (dbErr || !company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        return NextResponse.json(company);
    } catch (err) {
        console.error('[backoffice/companies/[id] GET]', err);
        return NextResponse.json({ error: 'Failed to get company' }, { status: 500 });
    }
}

/**
 * PUT /api/backoffice/companies/[id]
 * Update company details.
 * Body: { name?, email?, plan?, isActive? }
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const body = await request.json();
        const db = createAdminClient();

        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.email !== undefined) updates.email = body.email;
        if (body.plan !== undefined) updates.plan = body.plan;
        if (body.isActive !== undefined) updates.isActive = body.isActive;
        if (body.website !== undefined) updates.website = body.website;
        if (body.linkedinUrl !== undefined) updates.linkedinUrl = body.linkedinUrl;
        if (body.webContext !== undefined) updates.webContext = body.webContext;
        updates.updatedAt = new Date().toISOString();

        const { data, error: dbErr } = await db
            .from('Company')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (dbErr) throw dbErr;

        // Sync plan to License if plan changed
        if (body.plan !== undefined) {
            await db
                .from('License')
                .update({ plan: body.plan, updatedAt: new Date().toISOString() })
                .eq('companyId', id);
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error('[backoffice/companies/[id] PUT]', err);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

/**
 * DELETE /api/backoffice/companies/[id]
 * Delete company and ALL associated data (cascading).
 */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        // Verify company exists
        const { data: company } = await db.from('Company').select('id').eq('id', id).maybeSingle();
        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Get user IDs for this company (needed for user-scoped data)
        const { data: users } = await db.from('User').select('id').eq('companyId', id);
        const userIds = (users ?? []).map((u: { id: string }) => u.id);

        // Delete in dependency order
        if (userIds.length > 0) {
            await db.from('UsageMetric').delete().in('userId', userIds);
            await db.from('SupportTicket').delete().in('userId', userIds);
            await db.from('WorkflowRun').delete().in('userId', userIds);
            await db.from('DataQualityJob').delete().in('userId', userIds);
            await db.from('DiagnosticAssessment').delete().in('userId', userIds);
        }

        // Company-scoped deletes
        await db.from('DocumentEmbedding').delete().eq('companyId', id);
        await db.from('Document').delete().eq('companyId', id);
        await db.from('DocFolder').delete().eq('companyId', id);

        // Delete messages via conversations
        const { data: convos } = await db.from('Conversation').select('id').eq('companyId', id);
        const convoIds = (convos ?? []).map((c: { id: string }) => c.id);
        if (convoIds.length > 0) {
            await db.from('Message').delete().in('conversationId', convoIds);
        }
        await db.from('Conversation').delete().eq('companyId', id);

        await db.from('Workflow').delete().eq('companyId', id);
        await db.from('GovernanceTemplate').delete().eq('companyId', id);
        await db.from('UseCase').delete().eq('companyId', id);
        await db.from('CompanyFeature').delete().eq('companyId', id);
        await db.from('License').delete().eq('companyId', id);
        await db.from('UsageMetric').delete().eq('companyId', id);
        await db.from('SupportTicket').delete().eq('companyId', id);

        // Delete users
        await db.from('User').delete().eq('companyId', id);

        // Finally, delete company
        await db.from('Company').delete().eq('id', id);

        return NextResponse.json({ deleted: true, id });
    } catch (err) {
        console.error('[backoffice/companies/[id] DELETE]', err);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
