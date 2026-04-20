import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/company/access-groups/[id] — Get group detail with permissions.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        const { data: group, error: groupErr } = await db
            .from('AccessGroup')
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (groupErr) throw groupErr;
        if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

        // Load permissions
        const { data: grants } = await db
            .from('AccessPermissionGrant')
            .select('*')
            .eq('accessGroupId', id)
            .eq('companyId', auth.dbUser.companyId);

        // Load members
        const { data: memberships } = await db
            .from('AccessGroupMembership')
            .select('userId')
            .eq('accessGroupId', id)
            .eq('companyId', auth.dbUser.companyId);

        const userIds = (memberships || []).map((m: { userId: string }) => m.userId);
        let members: { id: string; name: string; email: string }[] = [];

        if (userIds.length > 0) {
            const { data: users } = await db
                .from('User')
                .select('id, name, email')
                .in('id', userIds);
            members = users || [];
        }

        // Parse permissions into structured shape
        const features: string[] = [];
        const subFeatures: string[] = [];
        let projectScope: { mode: string; ids: string[] } = { mode: 'none', ids: [] };

        for (const grant of (grants || []) as { resourceType: string; resourceKey: string }[]) {
            if (grant.resourceType === 'FEATURE') {
                features.push(grant.resourceKey);
            } else if (grant.resourceType === 'SUB_FEATURE') {
                subFeatures.push(grant.resourceKey);
            } else if (grant.resourceType === 'PROJECT_SCOPE') {
                if (grant.resourceKey === 'projects:all') {
                    projectScope = { mode: 'all', ids: [] };
                } else if (grant.resourceKey.startsWith('project:')) {
                    projectScope.mode = 'selected';
                    projectScope.ids.push(grant.resourceKey.replace('project:', ''));
                }
            }
        }

        return NextResponse.json({
            group: {
                ...group,
                permissions: { features, subFeatures, projectScope },
                members,
                memberCount: members.length,
            },
        });
    } catch (err) {
        console.error('[/api/company/access-groups/[id] GET]', err);
        return NextResponse.json({ error: 'Failed to load group' }, { status: 500 });
    }
}

/**
 * PUT /api/company/access-groups/[id] — Update group name, description, permissions.
 * Body: { name?, description?, permissions? }
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const body = await request.json();
        const db = createAdminClient();

        // Verify group exists
        const { data: existing } = await db
            .from('AccessGroup')
            .select('id, isSystemManaged')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .is('archivedAt', null)
            .maybeSingle();

        if (!existing) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

        // Prevent editing system-managed groups
        if (existing.isSystemManaged) {
            return NextResponse.json({ error: 'Cannot edit system-managed groups' }, { status: 403 });
        }

        // Check name uniqueness if name changed
        if (body.name) {
            const { data: duplicate } = await db
                .from('AccessGroup')
                .select('id')
                .eq('companyId', auth.dbUser.companyId)
                .eq('name', body.name.trim())
                .is('archivedAt', null)
                .neq('id', id)
                .maybeSingle();

            if (duplicate) {
                return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
            }
        }

        // Update group basic info
        const updates: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
            updatedById: auth.dbUser.id,
        };
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.description !== undefined) updates.description = body.description?.trim() || null;

        await db
            .from('AccessGroup')
            .update(updates)
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId);

        // Update permissions if provided
        if (body.permissions) {
            // Delete existing grants
            await db
                .from('AccessPermissionGrant')
                .delete()
                .eq('accessGroupId', id)
                .eq('companyId', auth.dbUser.companyId);

            // Insert new grants
            const grants: {
                id: string;
                companyId: string;
                accessGroupId: string;
                resourceType: string;
                resourceKey: string;
                accessLevel: string;
            }[] = [];

            if (body.permissions.features) {
                for (const key of body.permissions.features) {
                    grants.push({
                        id: crypto.randomUUID(),
                        companyId: auth.dbUser.companyId,
                        accessGroupId: id,
                        resourceType: 'FEATURE',
                        resourceKey: key,
                        accessLevel: 'USE',
                    });
                }
            }

            if (body.permissions.subFeatures) {
                for (const key of body.permissions.subFeatures) {
                    grants.push({
                        id: crypto.randomUUID(),
                        companyId: auth.dbUser.companyId,
                        accessGroupId: id,
                        resourceType: 'SUB_FEATURE',
                        resourceKey: key,
                        accessLevel: 'USE',
                    });
                }
            }

            if (body.permissions.projectScope) {
                if (body.permissions.projectScope.mode === 'all') {
                    grants.push({
                        id: crypto.randomUUID(),
                        companyId: auth.dbUser.companyId,
                        accessGroupId: id,
                        resourceType: 'PROJECT_SCOPE',
                        resourceKey: 'projects:all',
                        accessLevel: 'USE',
                    });
                } else if (body.permissions.projectScope.mode === 'selected') {
                    for (const pid of body.permissions.projectScope.ids || []) {
                        grants.push({
                            id: crypto.randomUUID(),
                            companyId: auth.dbUser.companyId,
                            accessGroupId: id,
                            resourceType: 'PROJECT_SCOPE',
                            resourceKey: `project:${pid}`,
                            accessLevel: 'USE',
                        });
                    }
                }
            }

            if (grants.length > 0) {
                await db.from('AccessPermissionGrant').insert(grants);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/company/access-groups/[id] PUT]', err);
        return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
    }
}

/**
 * DELETE /api/company/access-groups/[id] — Archive/delete a group.
 * Blocked if the group still has assigned users.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        // Verify group exists
        const { data: group } = await db
            .from('AccessGroup')
            .select('id, isSystemManaged')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .is('archivedAt', null)
            .maybeSingle();

        if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

        if (group.isSystemManaged) {
            return NextResponse.json({ error: 'Cannot delete system-managed groups' }, { status: 403 });
        }

        // Check if group has assigned users
        const { count } = await db
            .from('AccessGroupMembership')
            .select('id', { count: 'exact', head: true })
            .eq('accessGroupId', id)
            .eq('companyId', auth.dbUser.companyId);

        if ((count || 0) > 0) {
            return NextResponse.json({
                error: `Cannot delete group with ${count} assigned user(s). Remove all users first.`,
            }, { status: 400 });
        }

        // Soft delete (archive)
        await db
            .from('AccessGroup')
            .update({ archivedAt: new Date().toISOString(), updatedById: auth.dbUser.id })
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId);

        // Clean up permission grants
        await db
            .from('AccessPermissionGrant')
            .delete()
            .eq('accessGroupId', id)
            .eq('companyId', auth.dbUser.companyId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/company/access-groups/[id] DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
    }
}
