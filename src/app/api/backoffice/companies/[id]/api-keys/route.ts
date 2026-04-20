import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiKey } from '@/lib/apiKeyAuth';

/**
 * GET /api/backoffice/companies/[id]/api-keys — List API keys (prefix only)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id: companyId } = await params;
    const db = createAdminClient();

    const { data: keys } = await db
        .from('CompanyApiKey')
        .select('id, label, keyPrefix, scopes, isActive, lastUsedAt, createdAt')
        .eq('companyId', companyId)
        .order('createdAt', { ascending: false });

    return NextResponse.json({ keys: keys || [] });
}

/**
 * POST /api/backoffice/companies/[id]/api-keys — Generate a new API key
 * Body: { label, scopes? }
 * Returns: { key: { id, fullKey, keyPrefix, label, scopes } }
 *
 * ⚠️ fullKey is returned ONLY on creation. It cannot be retrieved later.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id: companyId } = await params;
    const { label, scopes } = await req.json();

    if (!label?.trim()) {
        return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const db = createAdminClient();

    // Verify company exists
    const { data: company } = await db
        .from('Company')
        .select('id')
        .eq('id', companyId)
        .maybeSingle();

    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    // Generate key
    const { fullKey, keyHash, keyPrefix } = generateApiKey();
    const keyId = crypto.randomUUID();
    const keyScopes = scopes && Array.isArray(scopes) && scopes.length > 0 ? scopes : ['crm:leads:write'];

    await db.from('CompanyApiKey').insert({
        id: keyId,
        companyId,
        label: label.trim(),
        keyHash,
        keyPrefix,
        scopes: keyScopes,
        isActive: true,
    });

    return NextResponse.json({
        key: {
            id: keyId,
            fullKey,           // ⚠️ Only returned once!
            keyPrefix,
            label: label.trim(),
            scopes: keyScopes,
        },
    }, { status: 201 });
}

/**
 * DELETE /api/backoffice/companies/[id]/api-keys — Revoke an API key
 * Query: ?keyId=<uuid>
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id: companyId } = await params;
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get('keyId');

    if (!keyId) return NextResponse.json({ error: 'keyId is required' }, { status: 400 });

    const db = createAdminClient();

    await db
        .from('CompanyApiKey')
        .update({ isActive: false })
        .eq('id', keyId)
        .eq('companyId', companyId);

    return NextResponse.json({ success: true });
}
