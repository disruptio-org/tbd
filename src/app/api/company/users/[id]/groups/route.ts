import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PUT /api/company/users/[id]/groups — Replace a user's group assignments.
 * Body: { groupIds: string[] }
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const body = await request.json();
        const { groupIds = [] } = body;
        const db = createAdminClient();

        // Verify user belongs to this company
        const { data: user } = await db
            .from('User')
            .select('id')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Validate groups belong to this company and are not archived
        let validGroupIds: string[] = [];
        if (groupIds.length > 0) {
            const { data: validGroups } = await db
                .from('AccessGroup')
                .select('id')
                .in('id', groupIds)
                .eq('companyId', auth.dbUser.companyId)
                .is('archivedAt', null);

            validGroupIds = (validGroups || []).map((g: { id: string }) => g.id);
        }

        // Delete existing memberships
        await db
            .from('AccessGroupMembership')
            .delete()
            .eq('userId', id)
            .eq('companyId', auth.dbUser.companyId);

        // Insert new memberships
        if (validGroupIds.length > 0) {
            const memberships = validGroupIds.map((gId) => ({
                id: crypto.randomUUID(),
                companyId: auth.dbUser.companyId,
                accessGroupId: gId,
                userId: id,
                createdById: auth.dbUser.id,
            }));

            const { error: insertErr } = await db
                .from('AccessGroupMembership')
                .insert(memberships);

            if (insertErr) throw insertErr;
        }

        return NextResponse.json({ success: true, assignedGroupIds: validGroupIds });
    } catch (err) {
        console.error('[/api/company/users/[id]/groups PUT]', err);
        return NextResponse.json({ error: 'Failed to update group assignments' }, { status: 500 });
    }
}
