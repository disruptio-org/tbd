import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/user/onboarding-status
 * Returns onboarding state for the current authenticated user.
 * Used by dashboard layout to decide redirects.
 */
export async function GET() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const db = createAdminClient();

        // Look up DB user
        const { data: dbUser } = await db
            .from('User')
            .select('id, companyId, mustChangePassword, isProvisionedByAdmin, role')
            .eq('email', user.email ?? '')
            .maybeSingle();

        if (!dbUser) {
            // User not in DB yet — no onboarding needed (self-signup flow)
            return NextResponse.json({
                mustChangePassword: false,
                onboardingStatus: 'COMPLETED',
                currentStep: 1,
            });
        }

        // Check onboarding state for the company
        const { data: onboardingState } = await db
            .from('CompanyOnboardingState')
            .select('status, currentStep, completedSteps')
            .eq('companyId', dbUser.companyId)
            .maybeSingle();

        return NextResponse.json({
            mustChangePassword: dbUser.mustChangePassword ?? false,
            isProvisionedByAdmin: dbUser.isProvisionedByAdmin ?? false,
            onboardingStatus: onboardingState?.status ?? 'COMPLETED',
            currentStep: onboardingState?.currentStep ?? 1,
            completedSteps: onboardingState?.completedSteps ?? [],
        });
    } catch (err) {
        console.error('[/api/user/onboarding-status GET]', err);
        return NextResponse.json({ error: 'Failed to check onboarding status' }, { status: 500 });
    }
}
