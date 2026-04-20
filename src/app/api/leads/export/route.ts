import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/leads/export
 * Export leads to CSV. Accepts either searchRunId or leadListId.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchRunId, leadListId } = await request.json();

        if (!searchRunId && !leadListId) {
            return NextResponse.json({ error: 'searchRunId or leadListId is required' }, { status: 400 });
        }

        const db = createAdminClient();
        let leads: Record<string, unknown>[] = [];

        if (searchRunId) {
            // Verify ownership
            const { data: run } = await db
                .from('LeadSearchRun')
                .select('id')
                .eq('id', searchRunId)
                .eq('companyId', auth.dbUser.companyId)
                .maybeSingle();

            if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

            const { data: results } = await db
                .from('LeadResult')
                .select('*')
                .eq('searchRunId', searchRunId)
                .order('relevanceScore', { ascending: false });

            leads = results || [];

        } else if (leadListId) {
            // Verify ownership
            const { data: list } = await db
                .from('LeadList')
                .select('id')
                .eq('id', leadListId)
                .eq('companyId', auth.dbUser.companyId)
                .maybeSingle();

            if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

            const { data: items } = await db
                .from('LeadListItem')
                .select('leadResultId')
                .eq('leadListId', leadListId);

            if (items && items.length > 0) {
                const resultIds = items.map(i => i.leadResultId);
                const { data: results } = await db
                    .from('LeadResult')
                    .select('*')
                    .in('id', resultIds);
                leads = results || [];
            }
        }

        // Build CSV
        const headers = [
            'Company Name',
            'Website',
            'Industry',
            'Location',
            'Summary',
            'Why It Fits',
            'Suggested Approach',
            'Likely Contact Roles',
            'Source Links',
            'Relevance Score',
        ];

        const escapeCSV = (val: unknown): string => {
            const str = String(val ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const rows = leads.map(lead => [
            escapeCSV(lead.companyName),
            escapeCSV(lead.website),
            escapeCSV(lead.industry),
            escapeCSV(lead.location),
            escapeCSV(lead.summary),
            escapeCSV(lead.whyFit),
            escapeCSV(lead.suggestedApproach),
            escapeCSV(Array.isArray(lead.likelyContactRoles) ? (lead.likelyContactRoles as string[]).join('; ') : ''),
            escapeCSV(
                Array.isArray(lead.sourceLinks)
                    ? (lead.sourceLinks as Array<{ title?: string; url?: string }>).map(s => s.url || s.title || '').join('; ')
                    : ''
            ),
            escapeCSV(lead.relevanceScore),
        ].join(','));

        const csv = [headers.join(','), ...rows].join('\n');

        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="leads_export_${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });
    } catch (err) {
        console.error('[/api/leads/export POST]', err);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
