import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveEffectiveAccess } from '@/lib/access-resolver';
import { FEATURE_KEYS } from '@/lib/permissions';

/**
 * GET /api/user/features
 * Returns the list of enabled feature keys for the current user's company.
 * Also returns effective access data from the access group system.
 * Used by the dashboard layout to show/hide nav items and guard pages.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADMIN and SUPER_ADMIN bypass all feature restrictions — they get access to everything
    if (auth.dbUser.role === 'SUPER_ADMIN' || auth.dbUser.role === 'ADMIN') {
        let effectiveAccess = null;
        try {
            effectiveAccess = await resolveEffectiveAccess(auth.dbUser.id, auth.dbUser.companyId);
        } catch (e) {
            console.error('[/api/user/features] admin access resolver error:', e);
        }
        return NextResponse.json({
            features: [...FEATURE_KEYS],
            superAdmin: auth.dbUser.role === 'SUPER_ADMIN',
            role: auth.dbUser.role,
            effectiveAccess,
        });
    }

    try {
        const db = createAdminClient();

        const { data, error } = await db
            .from('CompanyFeature')
            .select('featureKey, enabled')
            .eq('companyId', auth.dbUser.companyId);

        if (error) throw error;

        // Return only enabled feature keys as a flat array (backward compat)
        const enabledFeatures = (data ?? [])
            .filter((f: { featureKey: string; enabled: boolean }) => f.enabled)
            .map((f: { featureKey: string; enabled: boolean }) => f.featureKey);

        // Also resolve effective access from access groups
        let effectiveAccess = null;
        try {
            effectiveAccess = await resolveEffectiveAccess(auth.dbUser.id, auth.dbUser.companyId);
        } catch (accessErr) {
            console.error('[/api/user/features] Access resolver error:', accessErr);
        }

        return NextResponse.json({
            features: enabledFeatures,
            effectiveAccess,
            role: auth.dbUser.role,
        });
    } catch (err) {
        console.error('[/api/user/features]', err);
        return NextResponse.json({ error: 'Failed to load features' }, { status: 500 });
    }
}

