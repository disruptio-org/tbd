import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        // Return a no-op client during build time / when env vars are not set
        // This prevents crashes during static page generation
        return null as unknown as ReturnType<typeof createBrowserClient>;
    }

    return createBrowserClient(url, key);
}
