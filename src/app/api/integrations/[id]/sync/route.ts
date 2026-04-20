/**
 * POST /api/integrations/[id]/sync — Trigger manual sync for this integration
 *
 * Runs sync in the background and returns immediately.
 * The UI polls integration status to see progress.
 */

import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncIntegration } from '@/lib/document-sources/ingestion';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    const { id: integrationId } = await params;
    const db = createAdminClient();

    // Verify integration belongs to user's company
    const { data: integration } = await db
        .from('CompanyIntegration')
        .select('id, provider, isActive')
        .eq('id', integrationId)
        .eq('companyId', auth.dbUser.companyId)
        .single();

    if (!integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    if (!integration.isActive) {
        return NextResponse.json({ error: 'Integration is not active' }, { status: 400 });
    }

    // Mark sync as in-progress immediately
    await db.from('CompanyIntegration').update({
        lastSyncStatus: 'SYNCING',
        updatedAt: new Date().toISOString(),
    }).eq('id', integrationId);

    // Fire-and-forget: run sync in the background
    syncIntegration(integrationId).then(result => {
        console.log(`[sync-route] Background sync complete for ${integrationId}:`, result);
    }).catch(err => {
        console.error(`[sync-route] Background sync failed for ${integrationId}:`, err);
        // Update status to FAILED
        db.from('CompanyIntegration').update({
            lastSyncStatus: 'FAILED',
            errorLog: String(err),
            updatedAt: new Date().toISOString(),
        }).eq('id', integrationId).then(() => {});
    });

    return NextResponse.json({
        message: 'Sync started in background. Refresh to see progress.',
        status: 'SYNCING',
    });
}
