import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/onboarding/state
 * Returns the CompanyOnboardingState for the current user's company.
 */
export async function GET() {
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

        const { data: state } = await db
            .from('CompanyOnboardingState')
            .select('*')
            .eq('companyId', dbUser.companyId)
            .maybeSingle();

        return NextResponse.json({ state: state || null });
    } catch (err) {
        console.error('[/api/onboarding/state GET]', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

/**
 * PUT /api/onboarding/state
 * Updates currentStep, completedSteps, stepDrafts.
 * Body: { currentStep?: number, completedSteps?: number[], stepDrafts?: Record<string, any> }
 */
export async function PUT(request: Request) {
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

        const body = await request.json();
        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

        if (body.currentStep !== undefined) updates.currentStep = body.currentStep;
        if (body.completedSteps !== undefined) updates.completedSteps = body.completedSteps;
        if (body.stepDrafts !== undefined) updates.stepDrafts = body.stepDrafts;

        const { data, error: dbErr } = await db
            .from('CompanyOnboardingState')
            .update(updates)
            .eq('companyId', dbUser.companyId)
            .select()
            .single();

        if (dbErr) throw dbErr;

        return NextResponse.json({ state: data });
    } catch (err) {
        console.error('[/api/onboarding/state PUT]', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
