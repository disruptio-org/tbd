import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/company/access-groups — List access groups in the current company.
 */
export async function GET() {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const db = createAdminClient();

        // Load groups
        const { data: groups, error: groupsErr } = await db
            .from('AccessGroup')
            .select('*')
            .eq('companyId', auth.dbUser.companyId)
            .is('archivedAt', null)
            .order('createdAt', { ascending: false });

        if (groupsErr) throw groupsErr;

        // Load member counts for each group
        const groupIds = (groups || []).map((g: { id: string }) => g.id);
        let memberCounts: Record<string, number> = {};

        if (groupIds.length > 0) {
            const { data: memberships } = await db
                .from('AccessGroupMembership')
                .select('accessGroupId')
                .in('accessGroupId', groupIds)
                .eq('companyId', auth.dbUser.companyId);

            for (const m of (memberships || []) as { accessGroupId: string }[]) {
                memberCounts[m.accessGroupId] = (memberCounts[m.accessGroupId] || 0) + 1;
            }
        }

        // Load permission summaries for each group
        let permissionSummaries: Record<string, { features: string[]; subFeatures: string[]; projectScope: string }> = {};

        if (groupIds.length > 0) {
            const { data: grants } = await db
                .from('AccessPermissionGrant')
                .select('accessGroupId, resourceType, resourceKey')
                .in('accessGroupId', groupIds)
                .eq('companyId', auth.dbUser.companyId);

            for (const grant of (grants || []) as { accessGroupId: string; resourceType: string; resourceKey: string }[]) {
                if (!permissionSummaries[grant.accessGroupId]) {
                    permissionSummaries[grant.accessGroupId] = { features: [], subFeatures: [], projectScope: 'none' };
                }
                const summary = permissionSummaries[grant.accessGroupId];

                if (grant.resourceType === 'FEATURE') {
                    summary.features.push(grant.resourceKey);
                } else if (grant.resourceType === 'SUB_FEATURE') {
                    summary.subFeatures.push(grant.resourceKey);
                } else if (grant.resourceType === 'PROJECT_SCOPE') {
                    if (grant.resourceKey === 'projects:all') {
                        summary.projectScope = 'all';
                    } else {
                        summary.projectScope = 'selected';
                    }
                }
            }
        }

        // Enrich groups with counts and summaries
        const enrichedGroups = (groups || []).map((g: { id: string }) => ({
            ...g,
            memberCount: memberCounts[g.id] || 0,
            permissions: permissionSummaries[g.id] || { features: [], subFeatures: [], projectScope: 'none' },
        }));

        return NextResponse.json({ groups: enrichedGroups });
    } catch (err) {
        console.error('[/api/company/access-groups GET]', err);
        return NextResponse.json({ error: 'Failed to load access groups' }, { status: 500 });
    }
}

/**
 * POST /api/company/access-groups — Create a new access group.
 * Body: { name, description?, permissions: { features, subFeatures, projectScope } }
 */
export async function POST(request: Request) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const body = await request.json();
        const { name, description, permissions } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        const db = createAdminClient();

        // Check name uniqueness within company
        const { data: existing } = await db
            .from('AccessGroup')
            .select('id')
            .eq('companyId', auth.dbUser.companyId)
            .eq('name', name.trim())
            .is('archivedAt', null)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
        }

        // Create group
        const groupId = crypto.randomUUID();
        const { data: group, error: createErr } = await db
            .from('AccessGroup')
            .insert({
                id: groupId,
                companyId: auth.dbUser.companyId,
                name: name.trim(),
                description: description?.trim() || null,
                createdById: auth.dbUser.id,
                updatedById: auth.dbUser.id,
            })
            .select('*')
            .single();

        if (createErr) throw createErr;

        // Create permission grants
        if (permissions) {
            const grants: {
                id: string;
                companyId: string;
                accessGroupId: string;
                resourceType: string;
                resourceKey: string;
                accessLevel: string;
            }[] = [];

            // Feature grants
            if (permissions.features && Array.isArray(permissions.features)) {
                for (const featureKey of permissions.features) {
                    grants.push({
                        id: crypto.randomUUID(),
                        companyId: auth.dbUser.companyId,
                        accessGroupId: groupId,
                        resourceType: 'FEATURE',
                        resourceKey: featureKey,
                        accessLevel: 'USE',
                    });
                }
            }

            // Sub-feature grants
            if (permissions.subFeatures && Array.isArray(permissions.subFeatures)) {
                for (const subKey of permissions.subFeatures) {
                    grants.push({
                        id: crypto.randomUUID(),
                        companyId: auth.dbUser.companyId,
                        accessGroupId: groupId,
                        resourceType: 'SUB_FEATURE',
                        resourceKey: subKey,
                        accessLevel: 'USE',
                    });
                }
            }

            // Project scope
            if (permissions.projectScope) {
                if (permissions.projectScope.mode === 'all') {
                    grants.push({
                        id: crypto.randomUUID(),
                        companyId: auth.dbUser.companyId,
                        accessGroupId: groupId,
                        resourceType: 'PROJECT_SCOPE',
                        resourceKey: 'projects:all',
                        accessLevel: 'USE',
                    });
                } else if (permissions.projectScope.mode === 'selected' && Array.isArray(permissions.projectScope.ids)) {
                    for (const projectId of permissions.projectScope.ids) {
                        grants.push({
                            id: crypto.randomUUID(),
                            companyId: auth.dbUser.companyId,
                            accessGroupId: groupId,
                            resourceType: 'PROJECT_SCOPE',
                            resourceKey: `project:${projectId}`,
                            accessLevel: 'USE',
                        });
                    }
                }
            }

            if (grants.length > 0) {
                const { error: grantErr } = await db.from('AccessPermissionGrant').insert(grants);
                if (grantErr) throw grantErr;
            }
        }

        return NextResponse.json({ group }, { status: 201 });
    } catch (err) {
        console.error('[/api/company/access-groups POST]', err);
        return NextResponse.json({ error: 'Failed to create access group' }, { status: 500 });
    }
}
