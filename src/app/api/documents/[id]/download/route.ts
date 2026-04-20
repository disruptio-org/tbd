import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await getCurrentUser();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const db = createAdminClient();

        // External documents (Notion, Google Drive) — return extractedText as markdown
        if (id.startsWith('ext-')) {
            const externalId = id.replace('ext-', '');
            console.log('[download] External doc request:', { id, externalId });

            const { data: extDoc, error: extDocErr } = await db
                .from('ExternalDocument')
                .select('filename, extractedText, mimeType, integrationId')
                .eq('id', externalId)
                .single();

            console.log('[download] ExternalDocument query:', {
                found: !!extDoc,
                error: extDocErr?.message,
                filename: extDoc?.filename,
                textLen: (extDoc?.extractedText || '').length,
            });

            if (!extDoc) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            // Verify company ownership
            const { data: integration } = await db
                .from('CompanyIntegration')
                .select('companyId')
                .eq('id', extDoc.integrationId)
                .single();

            console.log('[download] Company check:', {
                integrationCompanyId: integration?.companyId,
                userCompanyId: auth.dbUser.companyId,
                match: integration?.companyId === auth.dbUser.companyId,
            });

            if (!integration || integration.companyId !== auth.dbUser.companyId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            const content = extDoc.extractedText || '*(No content extracted)*';
            console.log('[download] Returning content:', content.substring(0, 100));
            return new NextResponse(content, {
                headers: {
                    'Content-Type': 'text/markdown; charset=utf-8',
                    'Content-Disposition': `inline; filename="${encodeURIComponent(extDoc.filename)}"`,
                    'Cache-Control': 'no-cache',
                },
            });
        }

        // Fetch document metadata
        const { data: doc, error } = await db
            .from('Document')
            .select('id, filename, storageKey, mimeType, companyId')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (error || !doc) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Download from Supabase Storage
        const { data: fileData, error: dlErr } = await db.storage
            .from('documents')
            .download(doc.storageKey);

        if (dlErr || !fileData) {
            console.error('[download] Storage error:', dlErr);
            return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
        }

        // Return the file with proper MIME type
        const buffer = Buffer.from(await fileData.arrayBuffer());
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': doc.mimeType || 'application/octet-stream',
                'Content-Disposition': `inline; filename="${encodeURIComponent(doc.filename)}"`,
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('[download] Error:', error);
        return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }
}

