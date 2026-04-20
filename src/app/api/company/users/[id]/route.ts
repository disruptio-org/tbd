import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/company/users/[id] — Get user detail.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        const { data: user, error: userErr } = await db
            .from('User')
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (userErr) throw userErr;
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Load assigned groups
        const { data: memberships } = await db
            .from('AccessGroupMembership')
            .select('accessGroupId')
            .eq('userId', id)
            .eq('companyId', auth.dbUser.companyId);

        const groupIds = (memberships || []).map((m: { accessGroupId: string }) => m.accessGroupId);
        let groups: { id: string; name: string; description: string | null }[] = [];

        if (groupIds.length > 0) {
            const { data: groupData } = await db
                .from('AccessGroup')
                .select('id, name, description')
                .in('id', groupIds)
                .is('archivedAt', null);
            groups = groupData || [];
        }

        return NextResponse.json({ user: { ...user, groups } });
    } catch (err) {
        console.error('[/api/company/users/[id] GET]', err);
        return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
    }
}

/**
 * PUT /api/company/users/[id] — Update user profile/role.
 * Body: { name?, role?, email? }
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const body = await request.json();
        const db = createAdminClient();

        // Verify user belongs to this company
        const { data: existing } = await db
            .from('User')
            .select('id, role')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Prevent assigning SUPER_ADMIN
        if (body.role === 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Cannot assign SUPER_ADMIN role' }, { status: 403 });
        }

        // If demoting an ADMIN, check last-admin safety
        if (existing.role === 'ADMIN' && body.role && body.role !== 'ADMIN') {
            const { count } = await db
                .from('User')
                .select('id', { count: 'exact', head: true })
                .eq('companyId', auth.dbUser.companyId)
                .eq('role', 'ADMIN')
                .eq('status', 'ACTIVE');

            if ((count || 0) <= 1) {
                return NextResponse.json({ error: 'Cannot demote the last active admin' }, { status: 400 });
            }
        }

        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.email !== undefined) updates.email = body.email.trim().toLowerCase();
        if (body.role !== undefined) updates.role = body.role;
        updates.updatedAt = new Date().toISOString();

        const { data: updated, error: updateErr } = await db
            .from('User')
            .update(updates)
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .select('*')
            .single();

        if (updateErr) throw updateErr;

        return NextResponse.json({ user: updated });
    } catch (err) {
        console.error('[/api/company/users/[id] PUT]', err);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
