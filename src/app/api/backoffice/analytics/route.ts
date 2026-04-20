import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/backoffice/analytics
 * Cross-company analytics for SUPER_ADMIN.
 */
export async function GET() {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const db = createAdminClient();

        // Overview counts
        const [companiesRes, usersRes, licensesRes, featuresRes] = await Promise.all([
            db.from('Company').select('id', { count: 'exact', head: true }),
            db.from('User').select('id', { count: 'exact', head: true }),
            db.from('License').select('id', { count: 'exact', head: true }).eq('isActive', true),
            db.from('CompanyFeature').select('id', { count: 'exact', head: true }).eq('enabled', true),
        ]);

        // Companies by plan
        const { data: companies } = await db
            .from('Company')
            .select('plan');

        const planCounts: Record<string, number> = {};
        (companies ?? []).forEach((c: { plan: string }) => {
            planCounts[c.plan] = (planCounts[c.plan] || 0) + 1;
        });

        const companiesByPlan = Object.entries(planCounts).map(([plan, count]) => ({
            plan,
            count,
        }));

        // Feature adoption rates
        const { data: allFeatures } = await db
            .from('CompanyFeature')
            .select('featureKey, enabled');

        const featureCounts: Record<string, { total: number; enabled: number }> = {};
        (allFeatures ?? []).forEach((f: { featureKey: string; enabled: boolean }) => {
            if (!featureCounts[f.featureKey]) {
                featureCounts[f.featureKey] = { total: 0, enabled: 0 };
            }
            featureCounts[f.featureKey].total++;
            if (f.enabled) featureCounts[f.featureKey].enabled++;
        });

        const featureAdoption = Object.entries(featureCounts).map(([key, counts]) => ({
            feature: key,
            adoption: counts.total > 0 ? Math.round((counts.enabled / counts.total) * 100) : 0,
            enabledCount: counts.enabled,
            totalCount: counts.total,
        }));

        // Recent activity (last 20 events across all companies)
        const { data: recentActivity } = await db
            .from('UsageMetric')
            .select('event, module, createdAt, User:userId(name), Company:companyId(name)')
            .order('createdAt', { ascending: false })
            .limit(20);

        const eventLabels: Record<string, string> = {
            document_upload: 'Upload de documento',
            document_delete: 'Documento eliminado',
            search_query: 'Pesquisa realizada',
            diagnostic_completed: 'Diagnóstico concluído',
            template_exported: 'Template exportado',
            template_customized: 'Template personalizado',
            workflow_executed: 'Workflow executado',
        };

        // Licenses expiring soon (next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const { data: expiringLicenses } = await db
            .from('License')
            .select('*, Company:companyId(name)')
            .not('expiresAt', 'is', null)
            .lte('expiresAt', thirtyDaysFromNow.toISOString())
            .eq('isActive', true);

        return NextResponse.json({
            overview: {
                totalCompanies: companiesRes.count ?? 0,
                totalUsers: usersRes.count ?? 0,
                activeLicenses: licensesRes.count ?? 0,
                enabledFeatures: featuresRes.count ?? 0,
            },
            companiesByPlan,
            featureAdoption,
            expiringLicenses: (expiringLicenses ?? []).map((l: Record<string, unknown>) => ({
                companyName: (l.Company as { name: string } | null)?.name ?? 'Unknown',
                plan: l.plan,
                expiresAt: l.expiresAt,
            })),
            recentActivity: (recentActivity ?? []).map((a: Record<string, unknown>) => ({
                event: eventLabels[a.event as string] || a.event,
                module: a.module,
                user: (a.User as { name: string } | null)?.name ?? 'Sistema',
                company: (a.Company as { name: string } | null)?.name ?? 'Unknown',
                time: a.createdAt,
            })),
        });
    } catch (err) {
        console.error('[backoffice/analytics GET]', err);
        return NextResponse.json({ error: 'Analytics failed' }, { status: 500 });
    }
}
