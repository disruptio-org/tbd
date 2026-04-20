/**
 * POST /api/wiki/backfill — Compile ALL existing documents into wiki pages.
 *
 * Idempotent — skips documents that already have wiki pages.
 * Streams progress events as NDJSON.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { compileToWiki } from '@/lib/wiki/compiler';

export async function POST() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = auth.dbUser.companyId;
    const db = createAdminClient();

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            };

            try {
                send({ step: 'starting', message: 'Collecting documents...' });

                // Fetch direct uploads with extracted text
                const { data: documents } = await db
                    .from('Document')
                    .select('id, filename, extractedText, projectId')
                    .eq('companyId', companyId)
                    .not('extractedText', 'is', null);

                // Fetch external documents with extracted text
                const { data: externalDocs } = await db
                    .from('ExternalDocument')
                    .select('id, title, extractedText')
                    .eq('companyId', companyId)
                    .not('extractedText', 'is', null);

                const allDocs = [
                    ...(documents || []).map(d => ({
                        id: d.id,
                        name: d.filename,
                        text: d.extractedText as string,
                        projectId: d.projectId as string | null,
                        source: 'document' as const,
                    })),
                    ...(externalDocs || []).map(d => ({
                        id: d.id,
                        name: d.title,
                        text: d.extractedText as string,
                        projectId: null,
                        source: 'external' as const,
                    })),
                ];

                send({ step: 'collected', totalDocuments: allDocs.length });

                // Check which documents already have wiki pages
                const existingSourceIds = new Set<string>();
                const { data: existingNodes } = await db
                    .from('KnowledgeNode')
                    .select('sourceDocumentIds')
                    .eq('companyId', companyId)
                    .eq('status', 'active')
                    .not('type', 'in', '("wiki_index","wiki_log")');

                for (const node of (existingNodes || [])) {
                    for (const id of (node.sourceDocumentIds || [])) {
                        existingSourceIds.add(id);
                    }
                }

                let processed = 0;
                let skipped = 0;
                let errors = 0;
                let totalEntities = 0;
                let totalEdges = 0;

                for (let i = 0; i < allDocs.length; i++) {
                    const doc = allDocs[i];

                    // Skip if already compiled
                    if (existingSourceIds.has(doc.id)) {
                        skipped++;
                        send({
                            step: 'skipped',
                            document: doc.name,
                            index: i + 1,
                            total: allDocs.length,
                            reason: 'Already compiled',
                        });
                        continue;
                    }

                    // Skip very short texts
                    if (!doc.text || doc.text.trim().length < 100) {
                        skipped++;
                        send({
                            step: 'skipped',
                            document: doc.name,
                            index: i + 1,
                            total: allDocs.length,
                            reason: 'Text too short',
                        });
                        continue;
                    }

                    try {
                        send({
                            step: 'compiling',
                            document: doc.name,
                            index: i + 1,
                            total: allDocs.length,
                        });

                        const result = await compileToWiki(companyId, doc.id, doc.text, {
                            documentName: doc.name,
                            projectId: doc.projectId,
                        });

                        processed++;
                        totalEntities += result.entitiesExtracted;
                        totalEdges += result.edgesCreated;

                        send({
                            step: 'compiled',
                            document: doc.name,
                            index: i + 1,
                            total: allDocs.length,
                            entities: result.entitiesExtracted,
                            edges: result.edgesCreated,
                            durationMs: result.durationMs,
                        });
                    } catch (err) {
                        errors++;
                        console.error(`[wiki/backfill] Error compiling doc "${doc.name}":`, err);
                        send({
                            step: 'error',
                            document: doc.name,
                            index: i + 1,
                            total: allDocs.length,
                            error: String(err),
                        });
                    }
                }

                send({
                    step: 'complete',
                    processed,
                    skipped,
                    errors,
                    totalDocuments: allDocs.length,
                    totalEntities,
                    totalEdges,
                });
            } catch (err) {
                console.error('[wiki/backfill] Fatal error:', err);
                send({ step: 'error', error: String(err) });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'Transfer-Encoding': 'chunked',
        },
    });
}
