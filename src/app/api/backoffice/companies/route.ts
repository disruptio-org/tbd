import { NextResponse, NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { FEATURE_KEYS } from '@/lib/permissions';

const AVAILABLE_FEATURES = [...FEATURE_KEYS];

/**
 * GET /api/backoffice/companies
 * List all companies with user count, feature count, license status.
 * Supports ?search= and ?plan= query params.
 */
export async function GET(request: NextRequest) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const db = createAdminClient();
        const { searchParams } = request.nextUrl;
        const search = searchParams.get('search') ?? '';
        const planFilter = searchParams.get('plan') ?? '';

        let query = db
            .from('Company')
            .select('*, User(id), CompanyFeature(id, featureKey, enabled), License(*)');

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }
        if (planFilter) {
            query = query.eq('plan', planFilter);
        }

        const { data: companies, error: dbErr } = await query.order('createdAt', { ascending: false });

        if (dbErr) throw dbErr;

        const result = (companies ?? []).map((c: Record<string, unknown>) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            plan: c.plan,
            isActive: c.isActive,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            userCount: Array.isArray(c.User) ? c.User.length : 0,
            featureCount: Array.isArray(c.CompanyFeature)
                ? (c.CompanyFeature as { enabled: boolean }[]).filter((f) => f.enabled).length
                : 0,
            license: Array.isArray(c.License) ? c.License[0] ?? null : c.License ?? null,
        }));

        return NextResponse.json(result);
    } catch (err) {
        console.error('[backoffice/companies GET]', err);
        return NextResponse.json({ error: 'Failed to list companies' }, { status: 500 });
    }
}

/**
 * POST /api/backoffice/companies
 * Create new company + first admin user + license + default features.
 * Body: { name, email, plan? }
 */
export async function POST(request: Request) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { name, email, plan, website, linkedinUrl, language } = await request.json();

        if (!name || !email) {
            return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
        }

        const db = createAdminClient();
        const companyId = crypto.randomUUID();
        const selectedPlan = plan || 'starter';
        const selectedLanguage = ['en', 'pt-PT', 'fr'].includes(language) ? language : 'en';

        // 1. Create company
        const { error: companyErr } = await db.from('Company').insert({
            id: companyId,
            name,
            email,
            plan: selectedPlan,
            language: selectedLanguage,
            website: website || null,
            linkedinUrl: linkedinUrl || null,
            updatedAt: new Date().toISOString(),
        });
        if (companyErr) throw companyErr;

        // 2. Create license
        const { error: licenseErr } = await db.from('License').insert({
            id: crypto.randomUUID(),
            companyId,
            plan: selectedPlan,
            updatedAt: new Date().toISOString(),
        });
        if (licenseErr) console.error('[backoffice] License creation error:', licenseErr);

        // 3. Create default features (all enabled)
        const features = AVAILABLE_FEATURES.map((key) => ({
            id: crypto.randomUUID(),
            companyId,
            featureKey: key,
            enabled: true,
            updatedAt: new Date().toISOString(),
        }));
        const { error: featErr } = await db.from('CompanyFeature').insert(features);
        if (featErr) console.error('[backoffice] Features creation error:', featErr);

        // 4. Return created company
        const { data: company } = await db
            .from('Company')
            .select('*, User(id), CompanyFeature(id, featureKey, enabled), License(*)')
            .eq('id', companyId)
            .single();

        return NextResponse.json(company, { status: 201 });
    } catch (err) {
        console.error('[backoffice/companies POST]', err);
        return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
    }
}
