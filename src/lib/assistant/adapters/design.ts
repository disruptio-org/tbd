/**
 * Design & Brand Director module adapter.
 * Generates wireframe artifacts using OpenAI.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import type { ModuleAdapter, AuthContext, AdapterResult } from './types';

const MODEL = 'gpt-5.4';

export const designAdapter: ModuleAdapter = {
    name: 'design',
    requiredParams: ['contentType', 'audience', 'goal', 'topic'],
    optionalParams: ['platform', 'tone', 'companyContext'],

    async execute(params: Record<string, unknown>, auth: AuthContext): Promise<AdapterResult> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { success: false, resultSummary: 'OpenAI API key not configured', error: 'OPENAI_API_KEY missing' };

        const db = createAdminClient();
        const openai = new OpenAI({ apiKey });

        const contentType = String(params.contentType || 'wireframe');
        const audience = String(params.audience || '');
        const goal = String(params.goal || '');
        const topic = String(params.topic || '');
        const platform = String(params.platform || 'desktop');

        try {
            // Load company context
            const { data: profile } = await db.from('CompanyProfile')
                .select('companyName, productDescription, targetCustomers, brandVoice')
                .eq('companyId', auth.companyId).maybeSingle();

            const systemPrompt = `You are a professional UI/UX wireframe designer.
Company: ${profile?.companyName || 'Unknown'}
Product: ${profile?.productDescription || 'Not specified'}
Target customers: ${profile?.targetCustomers || 'Not specified'}
Brand voice: ${profile?.brandVoice || 'Professional'}

Generate a detailed ${contentType} for: "${topic}"
Target audience: ${audience}
Main goal: ${goal}
Platform: ${platform}

Return JSON with the wireframe structure including sections, content blocks, copy, and layout spec.`;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (openai as any).responses.create({
                model: MODEL,
                instructions: systemPrompt,
                input: `Create a ${contentType} for ${topic}. Audience: ${audience}. Goal: ${goal}. Platform: ${platform}.`,
                temperature: 0.6,
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'wireframe_output',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                summary: { type: 'string' },
                                platform: { type: 'string' },
                                sections: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            label: { type: 'string' },
                                            type: { type: 'string' },
                                            headline: { type: 'string' },
                                            subtext: { type: 'string' },
                                            ctas: {
                                                type: 'array',
                                                items: { type: 'string' },
                                            },
                                            items: {
                                                type: 'array',
                                                items: { type: 'string' },
                                            },
                                        },
                                        required: ['id', 'label', 'type', 'headline', 'subtext', 'ctas', 'items'],
                                        additionalProperties: false,
                                    },
                                },
                                spec: {
                                    type: 'object',
                                    properties: {
                                        objective: { type: 'string' },
                                        primaryUser: { type: 'string' },
                                        threadBehavior: { type: 'string' },
                                        outputModel: { type: 'string' },
                                        iterationModel: { type: 'string' },
                                        versioning: { type: 'string' },
                                    },
                                    required: ['objective', 'primaryUser', 'threadBehavior', 'outputModel', 'iterationModel', 'versioning'],
                                    additionalProperties: false,
                                },
                                annotations: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            title: { type: 'string' },
                                            note: { type: 'string' },
                                        },
                                        required: ['title', 'note'],
                                        additionalProperties: false,
                                    },
                                },
                            },
                            required: ['title', 'summary', 'platform', 'sections', 'spec', 'annotations'],
                            additionalProperties: false,
                        },
                    },
                },
            });

            const output = JSON.parse(response.output_text || '{}');

            return {
                success: true,
                resultSummary: output.summary || `Generated ${contentType}: "${output.title}"`,
                inlinePreview: output.title,
                generatedId: undefined,
                deepLink: undefined, // The bubble handles artifact viewing
            };
        } catch (err) {
            console.error('[adapter/design] Error:', err);
            return { success: false, resultSummary: 'Wireframe generation failed', error: String(err) };
        }
    },
};
