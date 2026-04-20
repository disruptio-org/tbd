/**
 * GET  /api/integrations — List integrations for current user's company
 * POST /api/integrations — Start new integration connection (returns OAuth URL)
 */

import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdapter } from '@/lib/document-sources';

export async function GET() {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    const db = createAdminClient();
    const { data: integrations } = await db
        .from('CompanyIntegration')
        .select('id, provider, label, isActive, syncFrequency, lastSyncedAt, lastSyncStatus, actionCount, config, errorLog, createdAt')
        .eq('companyId', auth.dbUser.companyId)
        .order('createdAt', { ascending: false });

    // Strip oauthTokens from response for security
    return NextResponse.json({ integrations: integrations || [] });
}

export async function POST(req: Request) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    const { provider, label, token } = await req.json();

    if (!provider) {
        return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    const SUPPORTED_PROVIDERS = ['GOOGLE_DRIVE', 'NOTION', 'SHAREPOINT'];
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
        return NextResponse.json({ error: 'Unsupported provider for document integration' }, { status: 400 });
    }

    const db = createAdminClient();

    // Check if integration already exists
    const { data: existing } = await db
        .from('CompanyIntegration')
        .select('id')
        .eq('companyId', auth.dbUser.companyId)
        .eq('provider', provider)
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Integration already exists for this provider' }, { status: 409 });
    }

    const integrationId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Token-based providers (e.g. Notion Internal Integration Token)
    // The company admin pastes the token directly — no OAuth redirect needed
    const TOKEN_PROVIDERS = ['NOTION'];
    if (TOKEN_PROVIDERS.includes(provider) && token) {
        const adapter = getAdapter(provider);
        const oauthTokens = await adapter.handleCallback(token);

        await db.from('CompanyIntegration').insert({
            id: integrationId,
            companyId: auth.dbUser.companyId,
            provider,
            label: label || 'Notion',
            config: {},
            oauthTokens,
            isActive: true,
            updatedAt: now,
        });

        return NextResponse.json({ integrationId, connected: true }, { status: 201 });
    }

    // OAuth-based providers (e.g. Google Drive) — create pending record + redirect
    await db.from('CompanyIntegration').insert({
        id: integrationId,
        companyId: auth.dbUser.companyId,
        provider,
        label: label || provider.replace('_', ' '),
        config: {},
        isActive: false, // Will activate after OAuth completes
        updatedAt: now,
    });

    const adapter = getAdapter(provider);
    const authUrl = adapter.getAuthUrl(integrationId);

    return NextResponse.json({ authUrl, integrationId }, { status: 201 });
}

