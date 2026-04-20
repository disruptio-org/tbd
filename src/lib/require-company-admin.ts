import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Validates the current user is an ADMIN or SUPER_ADMIN within their company.
 * Returns { auth } on success, or { error: NextResponse } on failure.
 *
 * Usage:
 *   const { auth, error } = await requireCompanyAdmin();
 *   if (error) return error;
 *   // auth.dbUser is guaranteed to be ADMIN or SUPER_ADMIN
 */
export async function requireCompanyAdmin(): Promise<
    | { auth: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; error?: never }
    | { auth?: never; error: NextResponse }
> {
    const auth = await getCurrentUser();
    if (!auth) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    if (auth.dbUser.role !== 'ADMIN' && auth.dbUser.role !== 'SUPER_ADMIN') {
        return { error: NextResponse.json({ error: 'Forbidden — Company admin required' }, { status: 403 }) };
    }
    return { auth };
}
