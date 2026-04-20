/**
 * document-sources/ingestion.ts
 * Orchestrates the full sync + ingestion pipeline for external document sources.
 *
 * Flow per file:
 *   1. Download via adapter
 *   2. Hash content → skip unchanged files
 *   3. Extract text (reuses OCR logic patterns)
 *   4. Store/update ExternalDocument record
 *   5. Generate embeddings
 *
 * Flow per integration sync:
 *   1. Refresh OAuth token
 *   2. For each selected folder → list files → ingest each
 *   3. Detect removed files → soft-delete + remove embeddings
 *   4. Update integration sync status
 */

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { chunkText, generateEmbeddings, embedDocument } from '@/lib/embeddings';
import { getAdapter } from './index';
import type { OAuthTokens, ExternalFile } from './types';

/* ─── Text Extraction (simplified, reuses patterns from OCR route) ─── */

async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    // PDF extraction
    if (mimeType === 'application/pdf') {
        try {
            const path = await import('path');
            const { pathToFileURL } = await import('url');
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
            pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

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
        } catch (err) {
            console.error('[ingestion] PDF extraction failed:', err);
            return '';
        }
    }

    // DOCX extraction
    if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
    ) {
        try {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            return result.value || '';
        } catch (err) {
            console.error('[ingestion] DOCX extraction failed:', err);
            return '';
        }
    }

    // Plain text / CSV / exported Google Docs
    if (mimeType.startsWith('text/')) {
        return buffer.toString('utf-8');
    }

    // Image OCR via OpenAI Vision
    if (mimeType.startsWith('image/')) {
        try {
            const OpenAI = (await import('openai')).default;
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) return '';

            const openai = new OpenAI({ apiKey });
            const base64 = buffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64}`;

            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract ALL text from this image. Return only the extracted text.' },
                        { type: 'image_url', image_url: { url: dataUrl } },
                    ],
                }],
                max_completion_tokens: 4096,
            });

            return response.choices[0]?.message?.content || '';
        } catch (err) {
            console.error('[ingestion] Image OCR failed:', err);
            return '';
        }
    }

    // Fallback: try as text
    try {
        return buffer.toString('utf-8');
    } catch {
        return '';
    }
}

/* ─── Content Hashing ─────────────────────────────────── */

function hashContent(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/* ─── Ingest Single File ─────────────────────────────── */

export async function ingestExternalFile(
    companyId: string,
    integrationId: string,
    file: ExternalFile,
    tokens: OAuthTokens,
    provider: string
): Promise<{ status: 'synced' | 'skipped' | 'error'; chunks?: number }> {
    const db = createAdminClient();
    const adapter = getAdapter(provider);

    try {
        // 1. Download file
        const { buffer, exportedMimeType } = await adapter.downloadFile(tokens, file.id, file.mimeType);

        // 2. Hash content
        const contentHash = hashContent(buffer);

        // 3. Check if already synced with same hash
        const { data: existing } = await db
            .from('ExternalDocument')
            .select('id, contentHash')
            .eq('integrationId', integrationId)
            .eq('externalId', file.id)
            .maybeSingle();

        if (existing && existing.contentHash === contentHash) {
            // Hash matches — but check if embeddings were actually stored
            const { count: embeddingCount } = await db
                .from('DocumentEmbedding')
                .select('id', { count: 'exact', head: true })
                .eq('externalDocumentId', existing.id);

            if (embeddingCount && embeddingCount > 0) {
                console.log(`[ingestion] Skipping unchanged file (embeddings exist): ${file.name}`);
                return { status: 'skipped' };
            }

            // Embeddings are missing — use stored extractedText or re-extract
            console.log(`[ingestion] File unchanged but embeddings missing, regenerating: ${file.name}`);

            try {
                // Try to use already-stored extractedText first
                const { data: extDoc } = await db
                    .from('ExternalDocument')
                    .select('extractedText')
                    .eq('id', existing.id)
                    .single();

                let text = extDoc?.extractedText;
                if (!text || text.trim().length < 30) {
                    text = await extractTextFromBuffer(buffer, exportedMimeType);
                }

                if (!text || text.trim().length < 30) {
                    console.log(`[ingestion] Not enough text to embed: ${file.name} (${text?.length || 0} chars)`);
                    return { status: 'skipped' };
                }

                // Get or create sentinel document for FK
                const { data: sentinelDoc } = await db
                    .from('Document')
                    .select('id')
                    .eq('companyId', companyId)
                    .eq('filename', '__external_sentinel__')
                    .maybeSingle();

                let sentinelDocId = sentinelDoc?.id;
                if (!sentinelDocId) {
                    // Need a user ID for the uploadedById FK
                    const { data: anyUser } = await db
                        .from('User')
                        .select('id')
                        .eq('companyId', companyId)
                        .limit(1)
                        .single();
                    if (!anyUser) throw new Error('No user found in company for sentinel doc');

                    sentinelDocId = crypto.randomUUID();
                    const { error: insertError } = await db.from('Document').insert({
                        id: sentinelDocId,
                        companyId,
                        filename: '__external_sentinel__',
                        mimeType: 'application/octet-stream',
                        size: 0,
                        storageKey: '__sentinel__',
                        uploadedById: anyUser.id,
                        updatedAt: new Date().toISOString(),
                    });
                    
                    if (insertError) {
                        console.error('[ingestion] Failed to create sentinel document:', insertError);
                        throw new Error(`Failed to create sentinel document: ${insertError.message}`);
                    }
                    console.log(`[ingestion] Created sentinel document: ${sentinelDocId}`);
                }

                // Use the reusable embedDocument function
                const { chunksStored } = await embedDocument(sentinelDocId, companyId, text, existing.id);
                console.log(`[ingestion] ✓ Regenerated embeddings for: ${file.name} (${chunksStored} chunks)`);
                return { status: 'synced', chunks: chunksStored };
            } catch (embErr) {
                console.error(`[ingestion] ✗ Embedding regeneration failed for ${file.name}:`, embErr);
                return { status: 'error' };
            }
        }

        // 4. Extract text
        const extractedText = await extractTextFromBuffer(buffer, exportedMimeType);

        // 5. Upsert ExternalDocument record
        const docId = existing?.id || crypto.randomUUID();
        const now = new Date().toISOString();

        if (existing) {
            await db.from('ExternalDocument').update({
                filename: file.name,
                mimeType: file.mimeType,
                size: file.size,
                externalUrl: file.webViewLink,
                externalPath: file.path,
                extractedText,
                contentHash,
                lastExternalMod: file.modifiedTime,
                syncStatus: 'SYNCED',
                ocrProcessed: true,
                updatedAt: now,
            }).eq('id', existing.id);
        } else {
            await db.from('ExternalDocument').insert({
                id: docId,
                companyId,
                integrationId,
                externalId: file.id,
                externalUrl: file.webViewLink,
                filename: file.name,
                mimeType: file.mimeType,
                size: file.size,
                externalPath: file.path,
                extractedText,
                contentHash,
                lastExternalMod: file.modifiedTime,
                syncStatus: 'SYNCED',
                ocrProcessed: true,
                updatedAt: now,
            });
        }

        // 6. Generate embeddings
        let chunksStored = 0;
        if (extractedText && extractedText.trim().length > 30) {
            const chunks = chunkText(extractedText);
            if (chunks.length > 0) {
                const embeddings = await generateEmbeddings(chunks);

                // Delete existing embeddings for this external doc
                await db.from('DocumentEmbedding').delete().eq('externalDocumentId', docId);

                // We need a documentId for the FK — use a sentinel placeholder
                // Get or create a sentinel Document for this company
                let sentinelDocId = 'external-sentinel';
                const { data: sentinelDoc } = await db
                    .from('Document')
                    .select('id')
                    .eq('companyId', companyId)
                    .eq('filename', '__external_sentinel__')
                    .maybeSingle();

                if (sentinelDoc) {
                    sentinelDocId = sentinelDoc.id;
                } else {
                    // Need a user ID for the uploadedById FK
                    const { data: anyUser } = await db
                        .from('User')
                        .select('id')
                        .eq('companyId', companyId)
                        .limit(1)
                        .single();
                    
                    if (!anyUser) throw new Error('No user found in company for sentinel doc');

                    sentinelDocId = crypto.randomUUID();
                    const { error: insertError } = await db.from('Document').insert({
                        id: sentinelDocId,
                        companyId,
                        filename: '__external_sentinel__',
                        mimeType: 'application/octet-stream',
                        size: 0,
                        storageKey: '__sentinel__',
                        uploadedById: anyUser.id,
                        updatedAt: now,
                    });
                    
                    if (insertError) {
                        console.error('[ingestion] Failed to create sentinel document:', insertError);
                        throw new Error(`Failed to create sentinel document: ${insertError.message}`);
                    }
                }

                const rows = chunks.map((chunk, i) => ({
                    id: crypto.randomUUID(),
                    companyId,
                    documentId: sentinelDocId,
                    externalDocumentId: docId,
                    chunkIndex: i,
                    chunkText: chunk,
                    embedding: JSON.stringify(embeddings[i]),
                }));

                const { error } = await db.from('DocumentEmbedding').insert(rows);
                if (error) {
                    console.error('[ingestion] Embedding insert error:', error);
                    throw new Error(`Failed to insert embeddings: ${error.message}`);
                }
                chunksStored = rows.length;
            }
        }

        console.log(`[ingestion] ✓ Synced: ${file.name} (${chunksStored} chunks)`);

        // Auto-compile to wiki (non-blocking)
        if (extractedText && extractedText.trim().length > 100) {
            try {
                const { compileToWiki } = await import('@/lib/wiki/compiler');
                await compileToWiki(companyId, docId, extractedText, {
                    documentName: file.name,
                });
                console.log(`[ingestion] Wiki compiled for: ${file.name}`);
            } catch (wikiErr) {
                console.error('[ingestion] Wiki compile failed (non-critical):', wikiErr);
            }
        }

        return { status: 'synced', chunks: chunksStored };
    } catch (err) {
        console.error(`[ingestion] ✗ Error syncing ${file.name}:`, err);

        // Mark as error in DB
        await db.from('ExternalDocument').upsert({
            id: crypto.randomUUID(),
            companyId,
            integrationId,
            externalId: file.id,
            filename: file.name,
            mimeType: file.mimeType,
            syncStatus: 'ERROR',
            updatedAt: new Date().toISOString(),
        }, { onConflict: 'integrationId,externalId' });

        return { status: 'error' };
    }
}

/* ─── Full Integration Sync ──────────────────────────── */

export async function syncIntegration(integrationId: string): Promise<{
    success: boolean;
    synced: number;
    skipped: number;
    errors: number;
    total: number;
}> {
    const db = createAdminClient();

    // 1. Load integration
    const { data: integration } = await db
        .from('CompanyIntegration')
        .select('*')
        .eq('id', integrationId)
        .single();

    if (!integration) {
        throw new Error('Integration not found');
    }

    const provider = integration.provider;
    const adapter = getAdapter(provider);
    const config = typeof integration.config === 'string'
        ? JSON.parse(integration.config)
        : integration.config;

    let tokens: OAuthTokens = typeof integration.oauthTokens === 'string'
        ? JSON.parse(integration.oauthTokens)
        : integration.oauthTokens;

    if (!tokens?.accessToken) {
        await db.from('CompanyIntegration').update({
            lastSyncStatus: 'FAILED',
            errorLog: 'No OAuth tokens found. Please reconnect.',
            updatedAt: new Date().toISOString(),
        }).eq('id', integrationId);
        return { success: false, synced: 0, skipped: 0, errors: 0, total: 0 };
    }

    // 2. Refresh token if expired
    if (tokens.expiresAt && Date.now() > tokens.expiresAt - 60000) {
        try {
            tokens = await adapter.refreshToken(tokens);
            await db.from('CompanyIntegration').update({
                oauthTokens: tokens,
                updatedAt: new Date().toISOString(),
            }).eq('id', integrationId);
        } catch (err) {
            console.error('[sync] Token refresh failed:', err);
            await db.from('CompanyIntegration').update({
                lastSyncStatus: 'FAILED',
                errorLog: 'OAuth token refresh failed. Please reconnect.',
                updatedAt: new Date().toISOString(),
            }).eq('id', integrationId);
            return { success: false, synced: 0, skipped: 0, errors: 0, total: 0 };
        }
    }

    // 3. Get selected folders
    let selectedFolders: string[] = config.selectedFolders || [];

    // For token-based providers (e.g. Notion), auto-discover all accessible pages
    // when no specific folders have been selected yet
    const TOKEN_PROVIDERS = ['NOTION'];
    if (selectedFolders.length === 0 && TOKEN_PROVIDERS.includes(provider)) {
        console.log('[sync] No folders selected for token-based provider, auto-discovering...');
        try {
            const discoveredFolders = await adapter.listFolders(tokens);
            selectedFolders = discoveredFolders.map(f => f.id);
            console.log(`[sync] Auto-discovered ${selectedFolders.length} top-level items`);

            // Persist the discovered folders so Settings shows them as selected
            if (selectedFolders.length > 0) {
                await db.from('CompanyIntegration').update({
                    config: { ...config, selectedFolders },
                    updatedAt: new Date().toISOString(),
                }).eq('id', integrationId);
            }
        } catch (err) {
            console.error('[sync] Auto-discovery failed:', err);
        }
    }

    if (selectedFolders.length === 0) {
        console.log('[sync] No folders selected, nothing to sync');
        await db.from('CompanyIntegration').update({
            lastSyncStatus: 'SUCCESS',
            lastSyncedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }).eq('id', integrationId);
        return { success: true, synced: 0, skipped: 0, errors: 0, total: 0 };
    }

    // 4. List and ingest files from each folder
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const seenExternalIds = new Set<string>();

    for (const folderId of selectedFolders) {
        try {
            const files = await adapter.listFiles(tokens, folderId);
            for (const file of files) {
                seenExternalIds.add(file.id);
                const result = await ingestExternalFile(
                    integration.companyId,
                    integrationId,
                    file,
                    tokens,
                    provider
                );
                if (result.status === 'synced') synced++;
                else if (result.status === 'skipped') skipped++;
                else errors++;
            }
        } catch (err) {
            console.error(`[sync] Error listing files for folder ${folderId}:`, err);
            errors++;
        }
    }

    // 5. Detect deleted files (files in DB but not in the external source anymore)
    const { data: existingDocs } = await db
        .from('ExternalDocument')
        .select('id, externalId')
        .eq('integrationId', integrationId)
        .neq('syncStatus', 'DELETED');

    if (existingDocs) {
        for (const doc of existingDocs) {
            if (!seenExternalIds.has(doc.externalId)) {
                // File was removed from source — soft delete
                await db.from('DocumentEmbedding').delete().eq('externalDocumentId', doc.id);
                await db.from('ExternalDocument').update({
                    syncStatus: 'DELETED',
                    updatedAt: new Date().toISOString(),
                }).eq('id', doc.id);
                console.log(`[sync] Soft-deleted removed file: ${doc.externalId}`);
            }
        }
    }

    // 6. Update integration status
    const totalFiles = synced + skipped;
    const status = errors > 0 ? (synced > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCESS';

    await db.from('CompanyIntegration').update({
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: status,
        actionCount: totalFiles,
        errorLog: errors > 0 ? `${errors} file(s) failed to sync` : null,
        updatedAt: new Date().toISOString(),
    }).eq('id', integrationId);

    console.log(`[sync] Complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);
    return { success: status !== 'FAILED', synced, skipped, errors, total: synced + skipped + errors };
}
