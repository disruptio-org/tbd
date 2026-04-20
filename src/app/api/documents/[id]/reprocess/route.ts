import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/documents/[id]/reprocess
 * Re-triggers OCR processing for a document. Clears old embeddings,
 * resets status to PROCESSING, and runs the full OCR pipeline.
 */
export async function POST(
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

        // 1. Verify ownership and fetch document
        const { data: doc, error: docErr } = await db
            .from('Document')
            .select('id, companyId, storageKey, mimeType, filename')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (docErr || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 2. Reset status to PROCESSING
        await db.from('Document').update({
            ocrProcessed: false,
            ocrStatus: 'PROCESSING',
            ocrError: null,
            extractedText: null,
            updatedAt: new Date().toISOString(),
        }).eq('id', id);

        // 3. Delete old embeddings
        await db.from('DocumentEmbedding').delete().eq('documentId', id);

        // 4. Trigger OCR by calling our own OCR endpoint internally
        //    We build the request manually to reuse the existing OCR pipeline
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000';
        try {
            const ocrRes = await fetch(`${baseUrl}/api/ocr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Forward auth cookies for authentication
                    'Cookie': _request.headers.get('cookie') || '',
                },
                body: JSON.stringify({ documentId: id }),
            });

            if (ocrRes.ok) {
                const ocrData = await ocrRes.json();
                return NextResponse.json({
                    success: true,
                    documentId: id,
                    processed: true,
                    extractedText: ocrData.extractedText ? `${ocrData.extractedText.substring(0, 100)}...` : null,
                });
            } else {
                const errData = await ocrRes.json().catch(() => ({}));
                // OCR endpoint already sets ERROR status on the document
                return NextResponse.json({
                    success: false,
                    documentId: id,
                    error: errData.error || 'OCR processing failed',
                    detail: errData.detail,
                }, { status: 500 });
            }
        } catch (ocrError) {
            // If the internal call failed, mark the document as ERROR
            const errMsg = ocrError instanceof Error ? ocrError.message : String(ocrError);
            await db.from('Document').update({
                ocrStatus: 'ERROR',
                ocrError: errMsg,
                updatedAt: new Date().toISOString(),
            }).eq('id', id);

            return NextResponse.json({
                success: false,
                documentId: id,
                error: 'Reprocessing failed',
                detail: errMsg,
            }, { status: 500 });
        }
    } catch (error) {
        console.error('[reprocess] CATCH:', error);
        return NextResponse.json({ error: 'Reprocess failed', detail: String(error) }, { status: 500 });
    }
}
