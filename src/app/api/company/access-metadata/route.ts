import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import {
    FEATURE_KEYS,
    SUB_FEATURE_KEYS,
    FEATURE_LABELS,
    FEATURE_GROUPS,
    SUB_FEATURE_GROUPS,
    ACCESS_LEVELS,
} from '@/lib/permissions';

/**
 * GET /api/company/access-metadata — Available features, sub-features, labels,
 * and project list for the group editor UI.
 */
export async function GET() {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const db = createAdminClient();

        // Load company projects for scope selection
        const { data: projects } = await db
            .from('Project')
            .select('id, name')
            .eq('companyId', auth.dbUser.companyId)
            .order('name');

        return NextResponse.json({
            featureKeys: FEATURE_KEYS,
            subFeatureKeys: SUB_FEATURE_KEYS,
            labels: FEATURE_LABELS,
            featureGroups: FEATURE_GROUPS,
            subFeatureGroups: SUB_FEATURE_GROUPS,
            accessLevels: ACCESS_LEVELS,
            projects: projects || [],
        });
    } catch (err) {
        console.error('[/api/company/access-metadata GET]', err);
        return NextResponse.json({ error: 'Failed to load metadata' }, { status: 500 });
    }
}
