import { createAdminClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';

/**
 * Hash an API key using SHA-256.
 */
export function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key with nousio prefix.
 * Returns { fullKey, keyHash, keyPrefix }.
 */
export function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
    const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const fullKey = `nk_${randomBytes}`;
    const keyHash = hashApiKey(fullKey);
    const keyPrefix = fullKey.substring(0, 11); // "nk_" + 8 hex chars
    return { fullKey, keyHash, keyPrefix };
}

/**
 * Authenticate a request via API key.
 * Returns { companyId, keyId } on success, or { error, status } on failure.
 */
export async function authenticateApiKey(
    req: Request,
    requiredScope: string
): Promise<
    | { companyId: string; keyId: string; error?: never; status?: never }
    | { companyId?: never; keyId?: never; error: string; status: number }
> {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return { error: 'Missing x-api-key header', status: 401 };
    }

    const keyHash = hashApiKey(apiKey);
    const db = createAdminClient();

    const { data: keyRecord } = await db
        .from('CompanyApiKey')
        .select('id, companyId, scopes, isActive')
        .eq('keyHash', keyHash)
        .maybeSingle();

    if (!keyRecord) {
        return { error: 'Invalid API key', status: 401 };
    }

    if (!keyRecord.isActive) {
        return { error: 'API key has been revoked', status: 403 };
    }

    // Check scope
    const scopes: string[] = keyRecord.scopes || [];
    if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
        return { error: `Missing required scope: ${requiredScope}`, status: 403 };
    }

    // Update lastUsedAt (fire-and-forget)
    db.from('CompanyApiKey')
        .update({ lastUsedAt: new Date().toISOString() })
        .eq('id', keyRecord.id)
        .then(() => {});

    return { companyId: keyRecord.companyId, keyId: keyRecord.id };
}
