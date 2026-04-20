import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

/**
 * POST /api/classifications/classify
 * Run AI classification on a document.
 * Body: { documentId, classificationTypeId }
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { documentId, classificationTypeId } = await request.json();

        if (!documentId || !classificationTypeId) {
            return NextResponse.json(
                { error: 'documentId and classificationTypeId are required' },
                { status: 400 }
            );
        }

        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        // Fetch document
        const { data: doc } = await db
            .from('Document')
            .select('id, filename, extractedText, ocrProcessed, mimeType')
            .eq('id', documentId)
            .eq('companyId', companyId)
            .single();

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        if (!doc.ocrProcessed || !doc.extractedText) {
            return NextResponse.json(
                { error: 'Document must be OCR processed first. Please run OCR before classifying.' },
                { status: 400 }
            );
        }

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

        // Call OpenAI gpt-5.4 for extraction
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

        // Estimate confidence based on how many fields were extracted vs defined
        const definedCount = fieldDefs.length || 1;
        const extractedCount = Object.values(extractedFields).filter(
            (v) => v !== null && v !== undefined && v !== ''
        ).length;
        const confidence = Math.min(extractedCount / definedCount, 1);

        // Store result
        const resultId = crypto.randomUUID();
        const { data: result, error: insertError } = await db
            .from('ClassificationResult')
            .insert({
                id: resultId,
                companyId,
                documentId,
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
                documentId,
                filename: doc.filename,
                fieldsExtracted: extractedCount,
                confidence,
            },
        });

        return NextResponse.json({
            ...result,
            document: { id: doc.id, filename: doc.filename, mimeType: doc.mimeType },
        });
    } catch (err) {
        console.error('[classifications/classify POST]', err);
        return NextResponse.json({ error: 'Classification failed' }, { status: 500 });
    }
}
