/**
 * GET /api/integrations/[id]/folders — List available folders from the connected platform
 */

import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdapter } from '@/lib/document-sources';
import type { OAuthTokens, ExternalFolder } from '@/lib/document-sources/types';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    const { id: integrationId } = await params;
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parentId') || undefined;

    const db = createAdminClient();

    const { data: integration } = await db
        .from('CompanyIntegration')
        .select('id, provider, oauthTokens')
        .eq('id', integrationId)
        .eq('companyId', auth.dbUser.companyId)
        .single();

    if (!integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const tokens: OAuthTokens = typeof integration.oauthTokens === 'string'
        ? JSON.parse(integration.oauthTokens)
        : integration.oauthTokens;

    if (!tokens?.accessToken) {
        return NextResponse.json({ error: 'Not authenticated with provider' }, { status: 401 });
    }

    try {
        const adapter = getAdapter(integration.provider);
        const folders = await adapter.listFolders(tokens, parentId);

        // For each top-level folder, also fetch children (one level deep)
        const foldersWithChildren: ExternalFolder[] = await Promise.all(
            folders.map(async (folder) => {
                try {
                    const children = await adapter.listFolders(tokens, folder.id);
                    return { ...folder, children };
                } catch {
                    return { ...folder, children: [] };
                }
            })
        );

        return NextResponse.json({ folders: foldersWithChildren });
    } catch (err) {
        console.error('[folders] Folder listing failed:', err);
        return NextResponse.json({ error: 'Failed to list folders' }, { status: 502 });
    }
}
