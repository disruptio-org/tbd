import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncZapierSkills } from '@/lib/mcpClient';

/**
 * POST /api/backoffice/companies/[id]/integrations/sync — Sync Zapier actions as skills
 * Body: { integrationId }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id: companyId } = await params;
    const { integrationId } = await req.json();

    if (!integrationId) {
        return NextResponse.json({ error: 'integrationId is required' }, { status: 400 });
    }

    const db = createAdminClient();

    // Get integration config
    const { data: integration } = await db
        .from('CompanyIntegration')
        .select('id, config, provider')
        .eq('id', integrationId)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const config = typeof integration.config === 'string'
        ? JSON.parse(integration.config)
        : integration.config;

    if (!config?.mcpEndpointUrl) {
        return NextResponse.json({ error: 'MCP endpoint URL not configured' }, { status: 400 });
    }

    const result = await syncZapierSkills(companyId, integrationId, config.mcpEndpointUrl);

    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
        imported: result.imported,
        total: result.total,
        message: result.imported > 0
            ? `Imported ${result.imported} new skills (${result.total} total actions available)`
            : `All ${result.total} actions already imported`,
    });
}
