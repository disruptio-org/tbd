import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/classifications/export-excel?resultIds=id1,id2,...
 * Export classification results as CSV/Excel download.
 */
export async function GET(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const url = new URL(request.url);
        const resultIdsParam = url.searchParams.get('resultIds');

        if (!resultIdsParam) {
            return NextResponse.json({ error: 'resultIds parameter required' }, { status: 400 });
        }

        const resultIds = resultIdsParam.split(',').filter(Boolean);
        if (resultIds.length === 0) {
            return NextResponse.json({ error: 'No result IDs provided' }, { status: 400 });
        }

        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        // Fetch results
        const { data: results, error } = await db
            .from('ClassificationResult')
            .select('*')
            .in('id', resultIds)
            .eq('companyId', companyId)
            .order('createdAt', { ascending: true });

        if (error) throw error;
        if (!results || results.length === 0) {
            return NextResponse.json({ error: 'No results found' }, { status: 404 });
        }

        // Fetch document info for each result
        const docIds = [...new Set(results.map((r) => r.documentId))];
        const { data: docs } = await db
            .from('Document')
            .select('id, filename')
            .in('id', docIds);

        const docMap = new Map((docs ?? []).map((d) => [d.id, d.filename]));

        // Fetch classification type for field definitions
        const typeId = results[0].classificationTypeId;
        const { data: classType } = await db
            .from('ClassificationType')
            .select('name, fieldDefinitions')
            .eq('id', typeId)
            .single();

        const fieldDefs: Array<{ name: string }> = Array.isArray(classType?.fieldDefinitions)
            ? classType.fieldDefinitions
            : [];

        // Build CSV
        const fieldNames = fieldDefs.map((f) => f.name);
        const headers = ['#', 'Documento', ...fieldNames, 'Confiança', 'Estado', 'Data'];

        function escapeCsv(val: string): string {
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }

        const rows: string[] = [headers.map(escapeCsv).join(',')];

        results.forEach((r, idx) => {
            const fields = r.extractedFields || {};
            const row = [
                String(idx + 1),
                docMap.get(r.documentId) || r.documentId,
                ...fieldNames.map((fn) => {
                    const val = fields[fn];
                    return val !== null && val !== undefined ? String(val) : '';
                }),
                r.confidence !== null ? `${Math.round(r.confidence * 100)}%` : '',
                r.status || '',
                new Date(r.createdAt).toLocaleString('pt-PT'),
            ];
            rows.push(row.map(escapeCsv).join(','));
        });

        // Add BOM for Excel to recognize UTF-8
        const bom = '\uFEFF';
        const csv = bom + rows.join('\r\n');

        const typeName = classType?.name || 'classificacao';
        const date = new Date().toISOString().slice(0, 10);
        const filename = `${typeName}_${date}.csv`;

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (err) {
        console.error('[classifications/export-excel GET]', err);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
