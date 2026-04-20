import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

/**
 * GET /api/classifications
 * List all classification types for the current user's company.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data, error } = await db
            .from('ClassificationType')
            .select('*')
            .eq('companyId', auth.dbUser.companyId)
            .order('createdAt', { ascending: false });

        if (error) throw error;
        return NextResponse.json(data ?? []);
    } catch (err) {
        console.error('[classifications GET]', err);
        return NextResponse.json({ error: 'Failed to load classifications' }, { status: 500 });
    }
}

/**
 * POST /api/classifications
 * Create a new classification type.
 * Body: { name, description?, aiPrompt, fieldDefinitions? }
 * If fieldDefinitions is empty/missing, uses gpt-5.4 to suggest fields from the prompt.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { name, description, aiPrompt } = body;
        let { fieldDefinitions } = body;

        if (!name || !aiPrompt) {
            return NextResponse.json({ error: 'name and aiPrompt are required' }, { status: 400 });
        }

        // If no fields provided, ask AI to suggest them
        if (!fieldDefinitions || (Array.isArray(fieldDefinitions) && fieldDefinitions.length === 0)) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (apiKey) {
                const openai = new OpenAI({ apiKey });
                const completion = await openai.chat.completions.create({
                    model: 'gpt-5.4',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a document classification expert. Given a classification purpose, suggest a list of fields to extract from documents of this type. Return ONLY a JSON array with objects containing: { "name": "fieldName", "type": "string|number|date|boolean", "description": "brief description in Portuguese" }. Always respond with valid JSON, nothing else.`,
                        },
                        {
                            role: 'user',
                            content: `Classification purpose: "${aiPrompt}". Suggest the most relevant fields to extract from documents of type "${name}".`,
                        },
                    ],
                    temperature: 0.3,
                    max_completion_tokens: 1000,
                });

                const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
                try {
                    // Strip markdown code fences if present
                    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    fieldDefinitions = JSON.parse(cleaned);
                } catch {
                    fieldDefinitions = [];
                }
            } else {
                fieldDefinitions = [];
            }
        }

        const db = createAdminClient();
        const now = new Date().toISOString();

        const { data, error } = await db
            .from('ClassificationType')
            .insert({
                id: crypto.randomUUID(),
                companyId: auth.dbUser.companyId,
                createdById: auth.dbUser.id,
                name,
                description: description || null,
                aiPrompt,
                fieldDefinitions,
                isTemplate: false,
                updatedAt: now,
            })
            .select()
            .single();

        if (error) throw error;

        // Log history
        await db.from('ClassificationHistory').insert({
            id: crypto.randomUUID(),
            companyId: auth.dbUser.companyId,
            userId: auth.dbUser.id,
            classificationTypeId: data.id,
            action: 'created',
            metadata: { name, fieldCount: Array.isArray(fieldDefinitions) ? fieldDefinitions.length : 0 },
        });

        return NextResponse.json(data, { status: 201 });
    } catch (err) {
        console.error('[classifications POST]', err);
        return NextResponse.json({ error: 'Failed to create classification' }, { status: 500 });
    }
}
