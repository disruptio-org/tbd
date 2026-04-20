/**
 * Product module adapter.
 * Wraps product content generation (PRDs, feature specs, etc.).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { retrieveWikiAndRAGContext } from '@/lib/rag-retrieval';
import type { ModuleAdapter, AuthContext, AdapterResult } from './types';

const MODEL = 'gpt-5.4';

export const productAdapter: ModuleAdapter = {
    name: 'product',
    requiredParams: ['contentType', 'topic'],
    optionalParams: ['audience', 'goal'],

    async execute(params: Record<string, unknown>, auth: AuthContext): Promise<AdapterResult> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { success: false, resultSummary: 'OpenAI API key not configured', error: 'OPENAI_API_KEY missing' };

        const db = createAdminClient();
        const openai = new OpenAI({ apiKey });
        const topic = String(params.topic || '');
        const contentType = String(params.contentType || 'PRD');

        try {
            const { data: profile } = await db.from('CompanyProfile').select('companyName, description, productsServices, mainOfferings').eq('companyId', auth.companyId).maybeSingle();
            const contextParts: string[] = [];
            if (profile) {
                if (profile.companyName) contextParts.push(`Company: ${profile.companyName}`);
                if (profile.description) contextParts.push(`Description: ${profile.description}`);
                if (profile.productsServices) contextParts.push(`Products: ${profile.productsServices}`);
            }

            const { context: wikiRagContext, groundingLevel } = topic
                ? await retrieveWikiAndRAGContext(auth.companyId, topic)
                : { context: '', groundingLevel: 'NOT_FOUND' as const };
            const ragContext = wikiRagContext;

            const systemPrompt = `You are a product management assistant. Create ${contentType.replace(/_/g, ' ')} content.
${contextParts.join('\n')}
${ragContext}
IMPORTANT: Always generate content in English, regardless of the language of the source data.
Return JSON: { "title": "...", "content": "...", "summary": "one-line summary" }`;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (openai as any).responses.create({
                model: MODEL,
                instructions: systemPrompt,
                input: `Topic: ${topic}`,
                temperature: 0.6,
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'product_output',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                content: { type: 'string' },
                                summary: { type: 'string' },
                            },
                            required: ['title', 'content', 'summary'],
                            additionalProperties: false,
                        },
                    },
                },
            });

            const output = JSON.parse(response.output_text || '{}');
            const runId = crypto.randomUUID();

            await db.from('ProductGenerationRun').insert({
                id: runId, companyId: auth.companyId, userId: auth.userId,
                contentType, title: output.title || topic,
                inputPrompt: topic, outputText: output.content,
                generationContext: { source: 'action_assistant' },
                status: 'completed', updatedAt: new Date().toISOString(),
            });

            return {
                success: true,
                resultSummary: output.summary || `Generated product content: "${output.title}"`,
                deepLink: `/product?runId=${runId}`,
                inlinePreview: (output.content || '').substring(0, 200) + '…',
                groundingStatus: groundingLevel,
                generatedId: runId,
            };
        } catch (err) {
            console.error('[adapter/product] Error:', err);
            return { success: false, resultSummary: 'Product content generation failed', error: String(err) };
        }
    },
};
