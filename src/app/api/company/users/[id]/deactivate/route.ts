import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/company/users/[id]/deactivate — Deactivate a user.
 * Includes last-admin safety check.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        // Verify user belongs to this company
        const { data: user } = await db
            .from('User')
            .select('id, role, status')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (user.status === 'INACTIVE') {
            return NextResponse.json({ error: 'User is already inactive' }, { status: 400 });
        }

        // Prevent deactivating the last active admin
        if (user.role === 'ADMIN') {
            const { count } = await db
                .from('User')
                .select('id', { count: 'exact', head: true })
                .eq('companyId', auth.dbUser.companyId)
                .eq('role', 'ADMIN')
                .eq('status', 'ACTIVE');

            if ((count || 0) <= 1) {
                return NextResponse.json({ error: 'Cannot deactivate the last active admin' }, { status: 400 });
            }
        }

        // Prevent deactivating yourself
        if (id === auth.dbUser.id) {
            return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
        }

        const { error: updateErr } = await db
            .from('User')
            .update({ status: 'INACTIVE', deactivatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId);

        if (updateErr) throw updateErr;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/company/users/[id]/deactivate POST]', err);
        return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
    }
}
