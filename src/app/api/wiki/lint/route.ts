/**
 * GET  /api/wiki/lint — Trigger wiki health check for the current user's company (manual).
 * POST /api/wiki/lint — Cron-triggered: lint ALL companies with wiki nodes.
 *
 * GET is for manual use from the Company DNA page.
 * POST is triggered by Vercel Cron (daily at 06:00 UTC).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { lintWiki } from '@/lib/wiki/linter';

/**
 * GET — Manual lint for the current user's company.
 * Returns the full WikiHealthReport.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = auth.dbUser.companyId;

    try {
        const report = await lintWiki(companyId);
        return NextResponse.json(report);
    } catch (err) {
        console.error('[wiki/lint] Manual lint failed:', err);
        return NextResponse.json({ error: 'Lint failed', detail: String(err) }, { status: 500 });
    }
}

/**
 * POST — Cron-triggered lint for ALL companies.
 * Runs daily. Checks each company that has active wiki nodes.
 */
export async function POST(request: NextRequest) {
    // Verify cron secret (same pattern as /api/skills/scheduler)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createAdminClient();

    try {
        // Find all companies that have active wiki nodes (exclude system types)
        const { data: companyRows } = await db
            .from('KnowledgeNode')
            .select('companyId')
            .eq('status', 'active')
            .not('type', 'in', '("wiki_index","wiki_log")');

        if (!companyRows || companyRows.length === 0) {
            return NextResponse.json({ message: 'No companies with wiki nodes', linted: 0 });
        }

        // Deduplicate company IDs
        const companyIds = [...new Set(companyRows.map(r => r.companyId))];

        const results: {
            companyId: string;
            totalNodes: number;
            issues: number;
            critical: number;
            coverageScore: number;
        }[] = [];

        for (const companyId of companyIds) {
            try {
                const report = await lintWiki(companyId);
                results.push({
                    companyId,
                    totalNodes: report.totalNodes,
                    issues: report.issues.length,
                    critical: report.issueCounts.critical,
                    coverageScore: report.coverageScore,
                });
            } catch (err) {
                console.error(`[wiki/lint/cron] Failed for company ${companyId}:`, err);
                results.push({
                    companyId,
                    totalNodes: 0,
                    issues: -1,
                    critical: -1,
                    coverageScore: 0,
                });
            }
        }

        const totalIssues = results.reduce((sum, r) => sum + Math.max(0, r.issues), 0);
        const totalCritical = results.reduce((sum, r) => sum + Math.max(0, r.critical), 0);

        console.log(`[wiki/lint/cron] ✓ Linted ${companyIds.length} companies: ${totalIssues} issues (${totalCritical} critical)`);

        return NextResponse.json({
            message: `Linted ${companyIds.length} companies`,
            linted: companyIds.length,
            totalIssues,
            totalCritical,
            results,
        });
    } catch (err) {
        console.error('[wiki/lint/cron] Fatal error:', err);
        return NextResponse.json({ error: 'Cron lint failed', detail: String(err) }, { status: 500 });
    }
}
