import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/company/users/[id]/reactivate — Reactivate an inactive user.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        const { data: user } = await db
            .from('User')
            .select('id, status')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (user.status === 'ACTIVE') {
            return NextResponse.json({ error: 'User is already active' }, { status: 400 });
        }

        const { error: updateErr } = await db
            .from('User')
            .update({ status: 'ACTIVE', deactivatedAt: null, updatedAt: new Date().toISOString() })
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId);

        if (updateErr) throw updateErr;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/company/users/[id]/reactivate POST]', err);
        return NextResponse.json({ error: 'Failed to reactivate user' }, { status: 500 });
    }
}
