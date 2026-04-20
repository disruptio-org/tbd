import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { embedDocument } from '@/lib/embeddings';

function getAdminDb() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function POST(request: Request) {
    try {
        // 1. Auth check
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { documentId } = await request.json();
        if (!documentId) {
            return NextResponse.json({ error: 'documentId required' }, { status: 400 });
        }

        const db = getAdminDb();

        // 2. Fetch document record
        const { data: doc, error: docErr } = await db
            .from('Document')
            .select('*')
            .eq('id', documentId)
            .single();

        if (docErr || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 2b. Set status to PROCESSING
        await db.from('Document').update({ ocrStatus: 'PROCESSING', ocrError: null }).eq('id', documentId);

        // 3. Download file from Supabase Storage
        // Handle legacy storageKeys that include redundant 'documents/' prefix
        const downloadKey = doc.storageKey.startsWith('documents/')
            ? doc.storageKey.substring('documents/'.length)
            : doc.storageKey;
        const { data: fileData, error: downloadErr } = await db.storage
            .from('documents')
            .download(downloadKey);

        if (downloadErr || !fileData) {
            console.error('[ocr] Download error:', downloadErr);
            return NextResponse.json({
                error: 'File download failed',
                detail: downloadErr?.message ?? 'No file data',
            }, { status: 500 });
        }

        // 4. Extract text based on mime type
        let extractedText = '';
        const mime = (doc.mimeType || '').toLowerCase();

        if (mime === 'application/pdf') {
            extractedText = await extractFromPdf(fileData);
            // If pdfjs-dist returned empty text, the PDF likely has text as images
            // Fall back to OpenAI Vision for image-based PDFs
            if (!extractedText || extractedText.trim().length < 20) {
                console.log('[ocr] pdfjs-dist returned no text, falling back to OpenAI...');
                extractedText = await extractFromPdfViaOpenAI(fileData);
            }
        } else if (
            mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mime === 'application/msword'
        ) {
            extractedText = await extractFromDocx(fileData);
        } else if (mime.startsWith('image/')) {
            extractedText = await extractFromImage(fileData, mime);
        } else {
            // Try as plain text
            extractedText = await fileData.text();
        }

        // 5. Update Document record
        const now = new Date().toISOString();
        const { error: updateErr } = await db
            .from('Document')
            .update({
                extractedText,
                ocrProcessed: true,
                ocrStatus: 'PROCESSED',
                ocrError: null,
                updatedAt: now,
            })
            .eq('id', documentId);

        if (updateErr) {
            console.error('[ocr] Update error:', updateErr);
        }

        // 6. Auto-generate embeddings (non-blocking — don't fail OCR if embedding fails)
        if (extractedText && extractedText.trim().length > 0) {
            try {
                const embedResult = await embedDocument(documentId, doc.companyId, extractedText);
                console.log(`[ocr] Auto-embedded: ${embedResult.chunksStored} chunks`);
            } catch (embedErr) {
                console.error('[ocr] Auto-embed failed (non-critical):', embedErr);
            }

            // 6b. Auto-compile to wiki (non-blocking)
            try {
                const { compileToWiki } = await import('@/lib/wiki/compiler');
                await compileToWiki(doc.companyId, documentId, extractedText, {
                    documentName: doc.filename,
                });
                console.log(`[ocr] Wiki compiled for doc: ${documentId}`);
            } catch (wikiErr) {
                console.error('[ocr] Wiki compile failed (non-critical):', wikiErr);
            }
        }

        return NextResponse.json({
            documentId,
            extractedText,
            processed: true,
        });
    } catch (error) {
        console.error('[ocr] CATCH:', error);
        // Record the error in the document so the user can see why processing failed
        try {
            const db = getAdminDb();
            const errMsg = error instanceof Error ? error.message : String(error);
            await db.from('Document').update({
                ocrStatus: 'ERROR',
                ocrError: errMsg,
                updatedAt: new Date().toISOString(),
            }).eq('id', (await request.clone().json()).documentId);
        } catch { /* best-effort */ }
        return NextResponse.json({ error: 'OCR failed', detail: String(error) }, { status: 500 });
    }
}

// ─── PDF extraction using pdfjs-dist directly (no worker needed) ──
async function extractFromPdf(blob: Blob): Promise<string> {
    const path = await import('path');
    const { pathToFileURL } = await import('url');
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Point workerSrc to the actual file using file:// URL (required on Windows)
    const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
        useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageText = content.items.map((item: any) => item.str).join(' ');
        textParts.push(pageText);
    }

    return textParts.join('\n');
}

// ─── DOCX extraction using mammoth ────────────────────────
async function extractFromDocx(blob: Blob): Promise<string> {
    const mammoth = await import('mammoth');
    const buffer = Buffer.from(await blob.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

// ─── Image OCR using OpenAI gpt-5.4 Vision ─────────────────
async function extractFromImage(blob: Blob, mimeType: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return '[OCR indisponível: OPENAI_API_KEY não configurada]';
    }

    const openai = new OpenAI({ apiKey });
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-5.4',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'Extract ALL text from this image. Return only the extracted text, preserving the original structure and formatting as much as possible. If the image contains tables, reproduce them. If there is no text, respond with "[Sem texto encontrado na imagem]".',
                    },
                    {
                        type: 'image_url',
                        image_url: { url: dataUrl },
                    },
                ],
            },
        ],
        max_completion_tokens: 4096,
    });

    return response.choices[0]?.message?.content || '[Sem texto extraído]';
}

// ─── PDF OCR fallback: send entire PDF to OpenAI for text extraction ──
async function extractFromPdfViaOpenAI(blob: Blob): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return '[OCR indisponível: OPENAI_API_KEY não configurada]';
    }

    const openai = new OpenAI({ apiKey });
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = buffer.toString('base64');

    const response = await openai.chat.completions.create({
        model: 'gpt-5.4',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'Extract ALL text content from this PDF document. Return only the extracted text, preserving structure and formatting. Include headings, paragraphs, bullet points, and table content. If the document contains images with text, extract that text too. Respond in the document\'s original language.',
                    },
                    {
                        type: 'file',
                        file: {
                            filename: 'document.pdf',
                            file_data: `data:application/pdf;base64,${base64}`,
                        },
                    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                ],
            },
        ],
        max_completion_tokens: 16384,
    });

    return response.choices[0]?.message?.content || '[Sem texto extraído do PDF]';
}
