/**
 * GET /api/integrations/[id]/documents — List synced external documents for this integration
 */

import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    const { id: integrationId } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // Optional filter: SYNCED | PENDING | ERROR | DELETED

    const db = createAdminClient();

    // Verify integration belongs to user's company
    const { data: integration } = await db
        .from('CompanyIntegration')
        .select('id')
        .eq('id', integrationId)
        .eq('companyId', auth.dbUser.companyId)
        .single();

    if (!integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    let query = db
        .from('ExternalDocument')
        .select('id, externalId, externalUrl, filename, mimeType, size, externalPath, syncStatus, knowledgeCategory, useAsKnowledgeSource, knowledgePriority, ocrProcessed, lastExternalMod, createdAt, updatedAt')
        .eq('integrationId', integrationId);

    if (status) {
        query = query.eq('syncStatus', status);
    } else {
        // By default, don't show deleted documents
        query = query.neq('syncStatus', 'DELETED');
    }

    const { data: documents } = await query.order('updatedAt', { ascending: false });

    return NextResponse.json({ documents: documents || [] });
}
