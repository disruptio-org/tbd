import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/classifications/export-images?resultIds=id1,id2,...
 * Returns JSON list of download URLs for the original documents linked to these results.
 * The frontend triggers individual downloads from /api/documents/[id]/download.
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

        // Fetch results to get document IDs
        const { data: results, error } = await db
            .from('ClassificationResult')
            .select('id, documentId')
            .in('id', resultIds)
            .eq('companyId', companyId);

        if (error) throw error;
        if (!results || results.length === 0) {
            return NextResponse.json({ error: 'No results found' }, { status: 404 });
        }

        // Fetch document info
        const docIds = [...new Set(results.map((r) => r.documentId))];
        const { data: docs } = await db
            .from('Document')
            .select('id, filename, mimeType')
            .in('id', docIds);

        const downloads = (docs ?? []).map((d) => ({
            documentId: d.id,
            filename: d.filename,
            mimeType: d.mimeType,
            downloadUrl: `/api/documents/${d.id}/download`,
        }));

        return NextResponse.json({ downloads });
    } catch (err) {
        console.error('[classifications/export-images GET]', err);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
