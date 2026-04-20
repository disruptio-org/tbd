/**
 * GET    /api/integrations/[id] — Get integration details
 * PUT    /api/integrations/[id] — Update integration config
 * DELETE /api/integrations/[id] — Disconnect and remove integration
 */

import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    const { id: integrationId } = await params;
    const db = createAdminClient();

    const { data: integration } = await db
        .from('CompanyIntegration')
        .select('id, provider, label, isActive, syncFrequency, lastSyncedAt, lastSyncStatus, actionCount, config, errorLog, createdAt')
        .eq('id', integrationId)
        .eq('companyId', auth.dbUser.companyId)
        .single();

    if (!integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Get sync stats
    const { count: totalDocs } = await db
        .from('ExternalDocument')
        .select('id', { count: 'exact', head: true })
        .eq('integrationId', integrationId)
        .neq('syncStatus', 'DELETED');

    const { count: errorDocs } = await db
        .from('ExternalDocument')
        .select('id', { count: 'exact', head: true })
        .eq('integrationId', integrationId)
        .eq('syncStatus', 'ERROR');

    return NextResponse.json({
        integration,
        stats: {
            totalDocuments: totalDocs || 0,
            errorDocuments: errorDocs || 0,
        },
    });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    const { id: integrationId } = await params;
    const body = await req.json();
    const db = createAdminClient();

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.config !== undefined) updates.config = body.config;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.label !== undefined) updates.label = body.label;
    if (body.syncFrequency !== undefined) updates.syncFrequency = body.syncFrequency;

    const { error: updateErr } = await db.from('CompanyIntegration')
        .update(updates)
        .eq('id', integrationId)
        .eq('companyId', auth.dbUser.companyId);

    if (updateErr) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    const { id: integrationId } = await params;
    const db = createAdminClient();

    // 1. Delete all embeddings linked to external documents of this integration
    const { data: extDocs } = await db
        .from('ExternalDocument')
        .select('id')
        .eq('integrationId', integrationId);

    if (extDocs && extDocs.length > 0) {
        const extDocIds = extDocs.map((d: { id: string }) => d.id);
        await db.from('DocumentEmbedding').delete().in('externalDocumentId', extDocIds);
    }

    // 2. Delete all external documents
    await db.from('ExternalDocument').delete().eq('integrationId', integrationId);

    // 3. Delete the integration itself
    await db.from('CompanyIntegration')
        .delete()
        .eq('id', integrationId)
        .eq('companyId', auth.dbUser.companyId);

    return NextResponse.json({ success: true });
}
