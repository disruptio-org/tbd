import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { resolveEffectiveAccess } from '@/lib/access-resolver';

/**
 * GET /api/company/users/[id]/effective-access — Get effective permissions for a user.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const access = await resolveEffectiveAccess(id, auth.dbUser.companyId);
        return NextResponse.json({ access });
    } catch (err) {
        console.error('[/api/company/users/[id]/effective-access GET]', err);
        return NextResponse.json({ error: 'Failed to resolve access' }, { status: 500 });
    }
}
