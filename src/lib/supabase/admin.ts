import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client using service role key.
 * Used for server-side DB operations (bypasses RLS).
 * Only use in API routes / server components — NEVER expose to the browser.
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
