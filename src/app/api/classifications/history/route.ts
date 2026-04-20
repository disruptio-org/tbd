import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/classifications/history
 * Returns classification runs grouped by batchId (or individual).
 * Each run includes summary info and the list of result IDs.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        // Fetch all classification history entries
        const { data: historyEntries, error } = await db
            .from('ClassificationHistory')
            .select('*')
            .eq('companyId', companyId)
            .eq('action', 'classified')
            .order('createdAt', { ascending: false });

        if (error) throw error;
        if (!historyEntries || historyEntries.length === 0) {
            return NextResponse.json({ runs: [] });
        }

        // Group by batchId (from metadata). Entries without batchId = individual runs.
        const runMap = new Map<string, typeof historyEntries>();

        for (const entry of historyEntries) {
            const batchId = entry.metadata?.batchId || `single_${entry.id}`;
            if (!runMap.has(batchId)) {
                runMap.set(batchId, []);
            }
            runMap.get(batchId)!.push(entry);
        }

        // Fetch classification types for names
        const typeIds = [...new Set(historyEntries.map((e) => e.classificationTypeId))];
        const { data: types } = await db
            .from('ClassificationType')
            .select('id, name, fieldDefinitions')
            .in('id', typeIds);

        const typeMap = new Map((types ?? []).map((t) => [t.id, t]));

        // Build run summaries
        const runs = Array.from(runMap.entries()).map(([batchId, entries]) => {
            const first = entries[0];
            const type = typeMap.get(first.classificationTypeId);
            const resultIds = entries
                .map((e) => e.classificationResultId)
                .filter(Boolean);

            const confidences = entries
                .map((e) => e.metadata?.confidence)
                .filter((c): c is number => typeof c === 'number');

            const avgConfidence = confidences.length > 0
                ? confidences.reduce((a, b) => a + b, 0) / confidences.length
                : null;

            return {
                batchId,
                classificationTypeId: first.classificationTypeId,
                classificationTypeName: type?.name || 'Desconhecido',
                fieldDefinitions: type?.fieldDefinitions || [],
                documentCount: entries.length,
                resultIds,
                avgConfidence,
                createdAt: first.createdAt,
            };
        });

        // Sort by date descending
        runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ runs });
    } catch (err) {
        console.error('[classifications/history GET]', err);
        return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
    }
}
