import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await getCurrentUser();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const db = createAdminClient();

        // External documents (Notion, Google Drive) use ext- prefixed IDs
        if (id.startsWith('ext-')) {
            const externalId = id.replace('ext-', '');
            const { data: extDoc, error: extErr } = await db
                .from('ExternalDocument')
                .select('id, filename, mimeType, size, extractedText, ocrProcessed, createdAt, externalUrl, integrationId')
                .eq('id', externalId)
                .single();

            if (extErr || !extDoc) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            // Verify the external doc belongs to the user's company via integration
            const { data: integration } = await db
                .from('CompanyIntegration')
                .select('companyId')
                .eq('id', extDoc.integrationId)
                .single();

            if (!integration || integration.companyId !== auth.dbUser.companyId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            return NextResponse.json({
                ...extDoc,
                id: `ext-${extDoc.id}`,
            });
        }

        const { data: doc, error } = await db
            .from('Document')
            .select('id, filename, mimeType, size, extractedText, ocrProcessed, createdAt')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (error || !doc) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json(doc);
    } catch (error) {
        console.error('Document fetch error:', error);
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}


export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await getCurrentUser();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const db = createAdminClient();

        // Handle external documents (Google Drive, Notion)
        if (id.startsWith('ext-')) {
            const externalId = id.replace('ext-', '');

            // Verify ownership via integration
            const { data: extDoc } = await db
                .from('ExternalDocument')
                .select('id, integrationId')
                .eq('id', externalId)
                .single();

            if (!extDoc) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            const { data: integration } = await db
                .from('CompanyIntegration')
                .select('companyId')
                .eq('id', extDoc.integrationId)
                .single();

            if (!integration || integration.companyId !== auth.dbUser.companyId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            // Delete embeddings then external document
            await db.from('DocumentEmbedding').delete().eq('documentId', externalId);
            await db.from('ExternalDocument').delete().eq('id', externalId);

            return NextResponse.json({ deleted: true, id });
        }

        // Verify ownership
        const { data: doc } = await db
            .from('Document')
            .select('id')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (!doc) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Delete embeddings then document
        await db.from('DocumentEmbedding').delete().eq('documentId', id);
        await db.from('Document').delete().eq('id', id);

        return NextResponse.json({ deleted: true, id });
    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}

/**
 * PATCH /api/documents/[id]
 * Update document properties (e.g. move to a different folder).
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await getCurrentUser();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const db = createAdminClient();

        // Build update object — only allow safe fields
        const updateData: Record<string, unknown> = {};
        if ('folderId' in body) {
            updateData.folderId = body.folderId || null;
        }
        if ('projectId' in body) {
            updateData.projectId = body.projectId || null;
        }
        if ('knowledgeCategory' in body) {
            updateData.knowledgeCategory = body.knowledgeCategory || null;
        }
        if ('useAsKnowledgeSource' in body) {
            updateData.useAsKnowledgeSource = !!body.useAsKnowledgeSource;
        }
        if ('knowledgePriority' in body) {
            const valid = ['normal', 'preferred', 'critical'];
            updateData.knowledgePriority = valid.includes(body.knowledgePriority) ? body.knowledgePriority : 'normal';
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { data, error } = await db
            .from('Document')
            .update(updateData)
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .select()
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Update failed' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Patch error:', error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
