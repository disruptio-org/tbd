import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/company/profile
 * Returns the CompanyProfile for the current user's company.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: profile, error } = await db
            .from('CompanyProfile')
            .select('*')
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({ profile: profile ?? null });
    } catch (err) {
        console.error('[/api/company/profile GET]', err);
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }
}

/**
 * PUT /api/company/profile
 * Creates or updates the CompanyProfile for the current user's company.
 */
export async function PUT(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const db = createAdminClient();

        // Validate required fields
        if (!body.companyName?.trim() || !body.description?.trim()) {
            return NextResponse.json(
                { error: 'companyName and description are required' },
                { status: 400 }
            );
        }

        const profileData = {
            companyId: auth.dbUser.companyId,
            companyName: body.companyName?.trim() ?? '',
            description: body.description?.trim() ?? '',
            industry: body.industry?.trim() || null,
            website: body.website?.trim() || null,
            foundedYear: body.foundedYear ? Number(body.foundedYear) : null,
            productsServices: body.productsServices?.trim() || null,
            mainOfferings: body.mainOfferings?.trim() || null,
            valueProposition: body.valueProposition?.trim() || null,
            targetCustomers: body.targetCustomers?.trim() || null,
            targetIndustries: body.targetIndustries?.trim() || null,
            markets: body.markets?.trim() || null,
            departments: body.departments?.trim() || null,
            internalTools: body.internalTools?.trim() || null,
            keyProcesses: body.keyProcesses?.trim() || null,
            competitors: body.competitors?.trim() || null,
            strategicGoals: body.strategicGoals?.trim() || null,
            brandTone: body.brandTone?.trim() || null,
            updatedAt: new Date().toISOString(),
        };

        // Check if profile exists
        const { data: existing } = await db
            .from('CompanyProfile')
            .select('id')
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        let result;

        if (existing) {
            // Update
            const { data, error } = await db
                .from('CompanyProfile')
                .update(profileData)
                .eq('companyId', auth.dbUser.companyId)
                .select()
                .single();
            if (error) throw error;
            result = data;
        } else {
            // Create
            const { data, error } = await db
                .from('CompanyProfile')
                .insert({ id: crypto.randomUUID(), ...profileData })
                .select()
                .single();
            if (error) throw error;
            result = data;
        }

        return NextResponse.json({ profile: result });
    } catch (err) {
        console.error('[/api/company/profile PUT]', err);
        return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }
}
