import { createAdminClient } from './supabase/admin';

/**
 * Ensures a User and Company record exist in the DB for the given Supabase user.
 * Uses Supabase Data API (HTTP) instead of Prisma.
 */
export async function ensureDbUser(supabaseUser: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; name?: string; avatar_url?: string };
    app_metadata?: { provider?: string };
}) {
    const db = createAdminClient();
    const email = supabaseUser.email ?? '';
    const name =
        supabaseUser.user_metadata?.full_name ??
        supabaseUser.user_metadata?.name ??
        email.split('@')[0];
    const avatar = supabaseUser.user_metadata?.avatar_url ?? null;
    const provider =
        supabaseUser.app_metadata?.provider === 'google' ? 'GOOGLE' : 'EMAIL';

    // Check if user already exists
    const { data: existing, error: lookupError } = await db
        .from('User')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (lookupError) {
        console.error('[ensureDbUser] Lookup error:', lookupError);
        // CRITICAL: Do NOT proceed to create a new user/company if lookup fails.
        // This prevents duplicate records when Supabase has transient errors.
        throw new Error(`User lookup failed: ${lookupError.message}`);
    }

    if (existing) {
        console.log('[ensureDbUser] Existing user found:', existing.id);
        return existing;
    }

    console.log('[ensureDbUser] Creating new user for:', email);

    // Create company
    const { data: company, error: companyError } = await db
        .from('Company')
        .insert({ id: crypto.randomUUID(), name: `${name}'s Company`, plan: 'starter', updatedAt: new Date().toISOString() })
        .select()
        .single();

    if (companyError || !company) {
        console.error('[ensureDbUser] Company creation error:', companyError);
        throw new Error(`Failed to create company: ${companyError?.message}`);
    }

    // Create user
    const { data: newUser, error: userError } = await db
        .from('User')
        .insert({
            id: supabaseUser.id,
            companyId: company.id,
            name,
            email,
            authProvider: provider,
            avatarUrl: avatar,
            role: 'ADMIN',
        })
        .select('*')
        .single();

    if (userError) {
        console.error('[ensureDbUser] User creation error:', userError);
        throw new Error(`Failed to create user: ${userError.message}`);
    }

    console.log('[ensureDbUser] Created user:', newUser?.id);
    return newUser;
}
