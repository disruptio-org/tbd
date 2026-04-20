import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const TRACKED_FIELDS = [
    'companyName', 'description', 'industry', 'website', 'foundedYear',
    'productsServices', 'mainOfferings', 'valueProposition',
    'targetCustomers', 'targetIndustries', 'markets',
    'departments', 'internalTools', 'keyProcesses',
    'competitors', 'strategicGoals', 'brandTone',
] as const;

/**
 * GET /api/company/profile/completion
 * Returns the profile completion score (0-100).
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: profile } = await db
            .from('CompanyProfile')
            .select('*')
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!profile) {
            return NextResponse.json({ completionScore: 0 });
        }

        const filled = TRACKED_FIELDS.filter((field) => {
            const value = (profile as Record<string, unknown>)[field];
            return value !== null && value !== undefined && String(value).trim() !== '';
        }).length;

        const completionScore = Math.round((filled / TRACKED_FIELDS.length) * 100);

        return NextResponse.json({ completionScore });
    } catch (err) {
        console.error('[/api/company/profile/completion GET]', err);
        return NextResponse.json({ error: 'Failed to calculate completion' }, { status: 500 });
    }
}
