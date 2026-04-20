import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

/**
 * POST /api/classifications/classify-batch
 * Run AI classification on multiple documents at once.
 * Body: { classificationTypeId, documentIds: string[] }
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { classificationTypeId, documentIds } = await request.json();

        if (!classificationTypeId || !Array.isArray(documentIds) || documentIds.length === 0) {
            return NextResponse.json(
                { error: 'classificationTypeId and documentIds[] are required' },
                { status: 400 }
            );
        }

        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        // Fetch classification type
        const { data: classType } = await db
            .from('ClassificationType')
            .select('*')
            .eq('id', classificationTypeId)
            .eq('companyId', companyId)
            .single();

        if (!classType) {
            return NextResponse.json({ error: 'Classification type not found' }, { status: 404 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey });
        const fieldDefs = Array.isArray(classType.fieldDefinitions)
            ? classType.fieldDefinitions
            : [];

        const fieldList = fieldDefs
            .map((f: { name: string; type: string; description?: string }) =>
                `- ${f.name} (${f.type}): ${f.description || ''}`
            )
            .join('\n');

        // Fetch all documents
        const { data: docs } = await db
            .from('Document')
            .select('id, filename, extractedText, ocrProcessed, mimeType, storageKey')
            .in('id', documentIds)
            .eq('companyId', companyId);

        if (!docs || docs.length === 0) {
            return NextResponse.json({ error: 'No documents found' }, { status: 404 });
        }

        const results: Array<{
            id: string;
            documentId: string;
            extractedFields: Record<string, unknown>;
            confidence: number;
            status: string;
            createdAt: string;
            document: { id: string; filename: string; mimeType: string };
            error?: string;
        }> = [];

        const batchId = crypto.randomUUID();

        // Process each document sequentially
        for (const doc of docs) {
            if (!doc.ocrProcessed || !doc.extractedText) {
                results.push({
                    id: '',
                    documentId: doc.id,
                    extractedFields: {},
                    confidence: 0,
                    status: 'failed',
                    createdAt: new Date().toISOString(),
                    document: { id: doc.id, filename: doc.filename, mimeType: doc.mimeType },
                    error: 'Document not OCR processed',
                });
                continue;
            }

            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-5.4',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a document classification AI. Extract the following fields from the document text provided. Return ONLY a valid JSON object with the field names as keys and the extracted values. If a field cannot be found, set its value to null. Do not include any explanation or markdown formatting, just the JSON object.

Classification type: ${classType.name}
Fields to extract:
${fieldList}

Additional instructions from the user: ${classType.aiPrompt}`,
                        },
                        {
                            role: 'user',
                            content: `Document text:\n\n${doc.extractedText.substring(0, 15000)}`,
                        },
                    ],
                    temperature: 0.1,
                    max_completion_tokens: 2000,
                });

                const rawResponse = completion.choices[0]?.message?.content?.trim() ?? '{}';
                let extractedFields: Record<string, unknown> = {};
                try {
                    const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    extractedFields = JSON.parse(cleaned);
                } catch {
                    extractedFields = { _raw: rawResponse };
                }

                const definedCount = fieldDefs.length || 1;
                const extractedCount = Object.values(extractedFields).filter(
                    (v) => v !== null && v !== undefined && v !== ''
                ).length;
                const confidence = Math.min(extractedCount / definedCount, 1);

                const resultId = crypto.randomUUID();
                const { data: result, error: insertError } = await db
                    .from('ClassificationResult')
                    .insert({
                        id: resultId,
                        companyId,
                        documentId: doc.id,
                        classificationTypeId,
                        extractedFields,
                        confidence,
                        status: 'completed',
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Log history
                await db.from('ClassificationHistory').insert({
                    id: crypto.randomUUID(),
                    companyId,
                    userId: auth.dbUser.id,
                    classificationTypeId,
                    classificationResultId: resultId,
                    action: 'classified',
                    metadata: {
                        batchId,
                        documentId: doc.id,
                        filename: doc.filename,
                        fieldsExtracted: extractedCount,
                        confidence,
                        batchProcess: true,
                    },
                });

                results.push({
                    ...result,
                    document: { id: doc.id, filename: doc.filename, mimeType: doc.mimeType },
                });
            } catch (docErr) {
                console.error(`[classify-batch] Error processing ${doc.filename}:`, docErr);
                results.push({
                    id: '',
                    documentId: doc.id,
                    extractedFields: {},
                    confidence: 0,
                    status: 'failed',
                    createdAt: new Date().toISOString(),
                    document: { id: doc.id, filename: doc.filename, mimeType: doc.mimeType },
                    error: 'Classification failed',
                });
            }
        }

        return NextResponse.json({ results });
    } catch (err) {
        console.error('[classifications/classify-batch POST]', err);
        return NextResponse.json({ error: 'Batch classification failed' }, { status: 500 });
    }
}
