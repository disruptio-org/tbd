import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/documents
 * 
 * Lists all documents for the current user's company.
 * Supports optional query params:
 *   - search: filter by filename
 *   - projectId: filter by project
 *   - countOnly: return only count
 */
export async function GET(request: Request) {
    try {
        const auth = await getCurrentUser();
        console.log('[GET /api/documents] Auth result:', auth ? `user=${auth.dbUser.email}, company=${auth.dbUser.companyId}` : 'NULL');
        
        if (!auth) {
            console.log('[GET /api/documents] No auth — returning empty');
            return NextResponse.json({ documents: [] });
        }

        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        const url = new URL(request.url);
        const search = url.searchParams.get('search');
        const projectId = url.searchParams.get('projectId');
        const countOnly = url.searchParams.get('countOnly');

        let query = db
            .from('Document')
            .select('id, filename, size, mimeType, ocrStatus, useAsKnowledgeSource, category, folderId, projectId, createdAt')
            .eq('companyId', companyId)
            .neq('filename', '__external_sentinel__');

        if (projectId) {
            query = query.eq('projectId', projectId);
        }

        if (search) {
            query = query.ilike('filename', `%${search}%`);
        }

        const { data, error } = await query.order('createdAt', { ascending: false });

        console.log('[GET /api/documents] Query result:', {
            count: data?.length ?? 0,
            error: error?.message ?? 'none',
            companyId,
        });

        if (error) {
            console.error('[GET /api/documents] Error:', error.message);
            return NextResponse.json({ documents: [] });
        }

        if (countOnly) {
            return NextResponse.json({ count: data?.length ?? 0 });
        }

        // Fetch folder names separately if any docs have folderId
        const folderIds = [...new Set((data ?? []).filter(d => d.folderId).map(d => d.folderId))];
        let folderMap: Record<string, string> = {};
        if (folderIds.length > 0) {
            const { data: folders } = await db
                .from('DocFolder')
                .select('id, name')
                .in('id', folderIds);
            if (folders) {
                folderMap = Object.fromEntries(folders.map(f => [f.id, f.name]));
            }
        }

        // Map to match what the knowledge page expects
        const documents = (data ?? []).map(doc => ({
            id: doc.id,
            filename: doc.filename,
            size: doc.size,
            mimeType: doc.mimeType,
            ocrStatus: doc.ocrStatus,
            isKnowledge: doc.useAsKnowledgeSource ?? false,
            category: doc.category,
            folderId: doc.folderId,
            folderName: doc.folderId ? folderMap[doc.folderId] : undefined,
            projectId: doc.projectId,
            createdAt: doc.createdAt,
            folder: doc.folderId ? { name: folderMap[doc.folderId] } : null,
        }));

        console.log(`[GET /api/documents] Returning ${documents.length} documents`);
        return NextResponse.json({ documents });
    } catch (error) {
        console.error('[GET /api/documents] CATCH:', error);
        return NextResponse.json({ documents: [] });
    }
}
