import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { FEATURE_KEYS, FEATURE_LABELS } from '@/lib/permissions';

const ALL_FEATURES = FEATURE_KEYS.map((key) => ({
    key,
    label: FEATURE_LABELS[key] || key,
}));

/**
 * GET /api/backoffice/companies/[id]/features
 * Returns full feature list with enabled/disabled state for the company.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        const { data: existing } = await db
            .from('CompanyFeature')
            .select('featureKey, enabled, updatedAt')
            .eq('companyId', id);

        const enabledMap: Record<string, { enabled: boolean; updatedAt: string }> = {};
        (existing ?? []).forEach((f: { featureKey: string; enabled: boolean; updatedAt: string }) => {
            enabledMap[f.featureKey] = { enabled: f.enabled, updatedAt: f.updatedAt };
        });

        const features = ALL_FEATURES.map((f) => ({
            key: f.key,
            label: f.label,
            enabled: enabledMap[f.key]?.enabled ?? false,
            updatedAt: enabledMap[f.key]?.updatedAt ?? null,
        }));

        return NextResponse.json(features);
    } catch (err) {
        console.error('[backoffice/features GET]', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

/**
 * PUT /api/backoffice/companies/[id]/features
 * Bulk update features.
 * Body: { features: [{ featureKey: string, enabled: boolean }] }
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const { features } = await request.json();

        if (!Array.isArray(features)) {
            return NextResponse.json({ error: 'features array required' }, { status: 400 });
        }

        const db = createAdminClient();
        const now = new Date().toISOString();

        for (const f of features as { featureKey: string; enabled: boolean }[]) {
            await db
                .from('CompanyFeature')
                .upsert(
                    {
                        id: crypto.randomUUID(),
                        companyId: id,
                        featureKey: f.featureKey,
                        enabled: f.enabled,
                        updatedAt: now,
                    },
                    { onConflict: 'companyId,featureKey' }
                );
        }

        // Return updated list
        const { data } = await db
            .from('CompanyFeature')
            .select('featureKey, enabled, updatedAt')
            .eq('companyId', id);

        return NextResponse.json(data ?? []);
    } catch (err) {
        console.error('[backoffice/features PUT]', err);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
