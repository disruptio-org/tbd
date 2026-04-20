/**
 * GET /api/integrations/callback — OAuth callback handler
 * Receives code + state (integrationId), exchanges for tokens, activates integration.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdapter } from '@/lib/document-sources';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // integrationId
    const errorParam = searchParams.get('error');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';

    if (errorParam) {
        console.error('[oauth-callback] OAuth error:', errorParam);
        return NextResponse.redirect(`${appUrl}/settings/integrations?error=${errorParam}`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${appUrl}/settings/integrations?error=missing_params`);
    }

    try {
        const db = createAdminClient();

        // Look up the pending integration
        const { data: integration } = await db
            .from('CompanyIntegration')
            .select('id, provider')
            .eq('id', state)
            .single();

        if (!integration) {
            return NextResponse.redirect(`${appUrl}/settings/integrations?error=integration_not_found`);
        }

        // Exchange code for tokens
        const adapter = getAdapter(integration.provider);
        const tokens = await adapter.handleCallback(code);

        // Update integration with tokens and activate
        await db.from('CompanyIntegration').update({
            oauthTokens: tokens,
            isActive: true,
            updatedAt: new Date().toISOString(),
        }).eq('id', integration.id);

        console.log(`[oauth-callback] Successfully connected ${integration.provider} (${integration.id})`);
        return NextResponse.redirect(`${appUrl}/settings/integrations?connected=${integration.provider}`);
    } catch (err) {
        console.error('[oauth-callback] Token exchange failed:', err);
        return NextResponse.redirect(`${appUrl}/settings/integrations?error=token_exchange_failed`);
    }
}
