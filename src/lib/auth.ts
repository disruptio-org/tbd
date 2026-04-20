import { createClient } from '@/lib/supabase/server';
import { ensureDbUser } from '@/lib/user';
import { NextResponse } from 'next/server';

/**
 * Gets the current authenticated user from Supabase session,
 * ensures they exist in the DB, and returns both the Supabase user and DB user.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
    try {
        const supabase = await createClient();
        const {
            data: { user: supabaseUser },
        } = await supabase.auth.getUser();

        if (!supabaseUser) {
            console.log('[auth] No Supabase user in session');
            return null;
        }

        const dbUser = await ensureDbUser(supabaseUser);
        return { supabaseUser, dbUser };
    } catch (error) {
        console.error('[auth] getCurrentUser error:', error);
        return null;
    }
}

/**
 * Validates the current user is a SUPER_ADMIN.
 * Returns { auth } on success, or { error: NextResponse } on failure.
 */
export async function requireSuperAdmin(): Promise<
    | { auth: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; error?: never }
    | { auth?: never; error: NextResponse }
> {
    const auth = await getCurrentUser();
    if (!auth) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    if (auth.dbUser.role !== 'SUPER_ADMIN') {
        return { error: NextResponse.json({ error: 'Forbidden — SUPER_ADMIN required' }, { status: 403 }) };
    }
    return { auth };
}

