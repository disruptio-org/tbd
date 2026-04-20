/**
 * Reusable authentication helper for API routes.
 * Wraps the Supabase auth + User lookup pattern.
 */
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AuthResult {
    userId: string;
    companyId: string;
    email: string;
    role: string;
}

/**
 * Verifies the current user session and returns auth context.
 * Returns null if not authenticated.
 */
export async function requireAuth(_req?: unknown): Promise<AuthResult | null> {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return null;

        const db = createAdminClient();
        const { data: dbUser } = await db
            .from('User')
            .select('id, companyId, role')
            .eq('email', user.email)
            .maybeSingle();

        if (!dbUser) return null;

        return {
            userId: dbUser.id,
            companyId: dbUser.companyId,
            email: user.email,
            role: dbUser.role,
        };
    } catch {
        return null;
    }
}
