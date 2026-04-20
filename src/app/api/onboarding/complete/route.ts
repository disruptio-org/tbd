import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/onboarding/complete
 * Marks the company onboarding as completed.
 */
export async function POST() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = createAdminClient();

        const { data: dbUser } = await db
            .from('User')
            .select('companyId')
            .eq('email', user.email ?? '')
            .maybeSingle();

        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const now = new Date().toISOString();

        const { data, error: dbErr } = await db
            .from('CompanyOnboardingState')
            .update({
                status: 'COMPLETED',
                completedAt: now,
                currentStep: 6,
                updatedAt: now,
            })
            .eq('companyId', dbUser.companyId)
            .select()
            .single();

        if (dbErr) throw dbErr;

        return NextResponse.json({ state: data });
    } catch (err) {
        console.error('[/api/onboarding/complete POST]', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
