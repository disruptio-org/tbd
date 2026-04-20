/* ═══════════════════════════════════════════════════════
   Effective Access Resolver
   ═══════════════════════════════════════════════════════
   Computes a user's effective permissions by:
   1. Loading their system role and status
   2. Loading all active access group memberships
   3. Unioning all AccessPermissionGrant entries
   4. Resolving project/workspace scopes
   5. Returning a structured EffectiveAccess object
   ═══════════════════════════════════════════════════════ */

import { createAdminClient } from '@/lib/supabase/admin';
import {
    type EffectiveAccess,
    type SystemRole,
    type UserStatus,
    FEATURE_KEYS,
    SUB_FEATURE_KEYS,
    buildBaselineAccess,
} from '@/lib/permissions';

interface PermissionGrant {
    resourceType: string;   // 'FEATURE' | 'SUB_FEATURE' | 'PROJECT_SCOPE'
    resourceKey: string;    // e.g. 'marketing', 'documents.upload', 'projects:all'
    accessLevel: string;    // 'VIEW' | 'USE' | 'MANAGE'
}

/**
 * Resolve the effective access for a user within their company.
 *
 * Algorithm:
 *  - Start with system role baseline (ADMIN gets everything, MEMBER gets minimal)
 *  - Load all active group memberships for this user
 *  - Union all permission grants from those groups
 *  - Merge project scope (union of all allowed projects, or "all")
 */
export async function resolveEffectiveAccess(
    userId: string,
    companyId: string,
): Promise<EffectiveAccess> {
    const db = createAdminClient();

    // 1. Load user role + status
    const { data: user, error: userErr } = await db
        .from('User')
        .select('role, status')
        .eq('id', userId)
        .eq('companyId', companyId)
        .maybeSingle();

    if (userErr || !user) {
        console.error('[resolveEffectiveAccess] User not found:', userErr);
        // Return a locked-down default
        return buildBaselineAccess('MEMBER', 'INACTIVE');
    }

    const role = (user.role || 'MEMBER') as SystemRole;
    const status = (user.status || 'ACTIVE') as UserStatus;

    // SUPER_ADMIN and ADMIN get full baseline access
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        return buildBaselineAccess(role, status);
    }

    // 2. Start with MEMBER baseline
    const access = buildBaselineAccess(role, status);

    // 3. Load group memberships
    const { data: memberships, error: memErr } = await db
        .from('AccessGroupMembership')
        .select('accessGroupId')
        .eq('userId', userId)
        .eq('companyId', companyId);

    if (memErr) {
        console.error('[resolveEffectiveAccess] Membership query error:', memErr);
        return access;
    }

    if (!memberships || memberships.length === 0) {
        // No groups → baseline only
        return access;
    }

    const groupIds = memberships.map((m: { accessGroupId: string }) => m.accessGroupId);

    // 4. Check groups are not archived
    const { data: activeGroups } = await db
        .from('AccessGroup')
        .select('id')
        .in('id', groupIds)
        .eq('companyId', companyId)
        .is('archivedAt', null);

    const activeGroupIds = (activeGroups || []).map((g: { id: string }) => g.id);
    if (activeGroupIds.length === 0) {
        return access;
    }

    // 5. Load all permission grants for active groups
    const { data: grants, error: grantErr } = await db
        .from('AccessPermissionGrant')
        .select('resourceType, resourceKey, accessLevel')
        .in('accessGroupId', activeGroupIds)
        .eq('companyId', companyId);

    if (grantErr) {
        console.error('[resolveEffectiveAccess] Grant query error:', grantErr);
        return access;
    }

    if (!grants || grants.length === 0) {
        return access;
    }

    // 6. Union all grants
    const projectIds = new Set<string>();
    let hasAllProjects = false;

    for (const grant of grants as PermissionGrant[]) {
        switch (grant.resourceType) {
            case 'FEATURE': {
                const key = grant.resourceKey;
                if ((FEATURE_KEYS as readonly string[]).includes(key)) {
                    access.features[key] = true;
                }
                break;
            }

            case 'SUB_FEATURE': {
                const key = grant.resourceKey;
                if ((SUB_FEATURE_KEYS as readonly string[]).includes(key)) {
                    access.subFeatures[key] = true;
                }
                break;
            }

            case 'PROJECT_SCOPE': {
                if (grant.resourceKey === 'projects:all') {
                    hasAllProjects = true;
                } else if (grant.resourceKey.startsWith('project:')) {
                    const projectId = grant.resourceKey.replace('project:', '');
                    projectIds.add(projectId);
                }
                break;
            }
        }
    }

    // 7. Resolve project scope
    if (hasAllProjects) {
        access.scopes.projects = { mode: 'all', ids: [] };
    } else if (projectIds.size > 0) {
        access.scopes.projects = { mode: 'selected', ids: Array.from(projectIds) };
    }
    // else: keep baseline (which for MEMBER = no special project scope)

    return access;
}

/**
 * Quick check: does the user have access to a specific feature?
 * Useful for API route guards.
 */
export async function hasFeatureAccess(
    userId: string,
    companyId: string,
    featureKey: string,
): Promise<boolean> {
    const access = await resolveEffectiveAccess(userId, companyId);
    if (access.status !== 'ACTIVE') return false;
    return access.features[featureKey] === true;
}

/**
 * Quick check: does the user have access to a specific project?
 */
export async function hasProjectAccess(
    userId: string,
    companyId: string,
    projectId: string,
): Promise<boolean> {
    const access = await resolveEffectiveAccess(userId, companyId);
    if (access.status !== 'ACTIVE') return false;
    if (access.scopes.projects.mode === 'all') return true;
    return access.scopes.projects.ids.includes(projectId);
}
