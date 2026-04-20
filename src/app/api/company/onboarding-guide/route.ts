import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/company/onboarding-guide
 * Returns the stored onboarding guide for the current company.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: guide, error } = await db
            .from('CompanyOnboardingGuide')
            .select('*')
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({ guide: guide ?? null });
    } catch (err) {
        console.error('[/api/company/onboarding-guide GET]', err);
        return NextResponse.json({ error: 'Failed to fetch onboarding guide' }, { status: 500 });
    }
}
