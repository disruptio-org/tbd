import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { discoverZapierActions, syncZapierSkills } from '@/lib/mcpClient';

/**
 * GET /api/backoffice/companies/[id]/integrations — List integrations
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id: companyId } = await params;
    const db = createAdminClient();

    const { data: integrations } = await db
        .from('CompanyIntegration')
        .select('id, provider, label, isActive, lastSyncedAt, actionCount, config, createdAt')
        .eq('companyId', companyId)
        .order('createdAt', { ascending: false });

    return NextResponse.json({ integrations: integrations || [] });
}

/**
 * POST /api/backoffice/companies/[id]/integrations — Connect a new integration
 * Body: { provider, label?, config: { mcpEndpointUrl } }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id: companyId } = await params;
    const { provider, label, config } = await req.json();

    if (!provider || !config?.mcpEndpointUrl) {
        return NextResponse.json({ error: 'provider and config.mcpEndpointUrl are required' }, { status: 400 });
    }

    const db = createAdminClient();

    // Check if integration already exists for this provider
    const { data: existing } = await db
        .from('CompanyIntegration')
        .select('id')
        .eq('companyId', companyId)
        .eq('provider', provider)
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Integration already exists for this provider' }, { status: 409 });
    }

    // Test the connection by discovering actions
    const discovery = await discoverZapierActions(config.mcpEndpointUrl);

    const integrationId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error: insertError } = await db.from('CompanyIntegration').insert({
        id: integrationId,
        companyId,
        provider,
        label: label || 'Zapier',
        config,
        isActive: true,
        actionCount: discovery.tools?.length || 0,
        lastSyncedAt: discovery.error ? null : now,
        updatedAt: now,
    });

    if (insertError) {
        console.error('[integrations] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to save integration', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
        integration: {
            id: integrationId,
            provider,
            label: label || 'Zapier',
            isActive: true,
            actionCount: discovery.tools?.length || 0,
            connectionTest: discovery.error ? { success: false, error: discovery.error } : { success: true, actionsFound: discovery.tools.length },
        },
    }, { status: 201 });
}

/**
 * PUT /api/backoffice/companies/[id]/integrations — Update integration config
 * Body: { integrationId, config?, isActive?, label? }
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id: companyId } = await params;
    const { integrationId, config, isActive, label } = await req.json();

    if (!integrationId) {
        return NextResponse.json({ error: 'integrationId is required' }, { status: 400 });
    }

    const db = createAdminClient();
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (config !== undefined) updates.config = config;
    if (isActive !== undefined) updates.isActive = isActive;
    if (label !== undefined) updates.label = label;

    await db.from('CompanyIntegration')
        .update(updates)
        .eq('id', integrationId)
        .eq('companyId', companyId);

    return NextResponse.json({ success: true });
}

/**
 * DELETE /api/backoffice/companies/[id]/integrations — Disconnect integration
 * Query: ?integrationId=<uuid>
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id: companyId } = await params;
    const { searchParams } = new URL(req.url);
    const integrationId = searchParams.get('integrationId');

    if (!integrationId) {
        return NextResponse.json({ error: 'integrationId is required' }, { status: 400 });
    }

    const db = createAdminClient();

    // Also remove imported skills
    await db.from('AssistantSkill')
        .delete()
        .eq('companyId', companyId)
        .eq('executionType', 'ZAPIER_MCP');

    await db.from('CompanyIntegration')
        .delete()
        .eq('id', integrationId)
        .eq('companyId', companyId);

    return NextResponse.json({ success: true });
}
