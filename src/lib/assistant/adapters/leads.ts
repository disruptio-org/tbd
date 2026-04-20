/**
 * Lead Discovery module adapter.
 * Wraps lead search functionality.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import type { ModuleAdapter, AuthContext, AdapterResult } from './types';

const MODEL = 'gpt-5.4';

export const leadsAdapter: ModuleAdapter = {
    name: 'leads',
    requiredParams: ['query'],
    optionalParams: ['industry', 'region', 'companySize'],

    async execute(params: Record<string, unknown>, auth: AuthContext): Promise<AdapterResult> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { success: false, resultSummary: 'OpenAI API key not configured', error: 'OPENAI_API_KEY missing' };

        const db = createAdminClient();
        const openai = new OpenAI({ apiKey });
        const query = String(params.query || '');

        try {
            // Load company context for ICP
            const { data: profile } = await db.from('CompanyProfile').select('companyName, targetCustomers, targetIndustries, markets').eq('companyId', auth.companyId).maybeSingle();

            const searchContext: Record<string, unknown> = {};
            if (params.industry) searchContext.industry = params.industry;
            if (params.region) searchContext.region = params.region;
            if (params.companySize) searchContext.companySize = params.companySize;

            const systemPrompt = `You are a B2B lead discovery assistant.
Company: ${profile?.companyName || 'Unknown'}
Target customers: ${profile?.targetCustomers || 'Not specified'}
Target industries: ${profile?.targetIndustries || 'Not specified'}
Markets: ${profile?.markets || 'Not specified'}

Search for B2B leads matching the user's criteria. Return JSON with an array of 5 potential leads:
{ "leads": [{ "companyName": "...", "industry": "...", "whyFit": "...", "suggestedApproach": "..." }], "summary": "..." }`;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (openai as any).responses.create({
                model: MODEL,
                instructions: systemPrompt,
                input: `Search: ${query}\nFilters: ${JSON.stringify(searchContext)}`,
                temperature: 0.5,
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'leads_output',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                leads: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            companyName: { type: 'string' },
                                            industry: { type: 'string' },
                                            whyFit: { type: 'string' },
                                            suggestedApproach: { type: 'string' },
                                        },
                                        required: ['companyName', 'industry', 'whyFit', 'suggestedApproach'],
                                        additionalProperties: false,
                                    },
                                },
                                summary: { type: 'string' },
                            },
                            required: ['leads', 'summary'],
                            additionalProperties: false,
                        },
                    },
                },
            });

            const output = JSON.parse(response.output_text || '{}');
            const runId = crypto.randomUUID();

            // Save search run
            await db.from('LeadSearchRun').insert({
                id: runId, companyId: auth.companyId, userId: auth.userId,
                title: query.substring(0, 100), query,
                searchContext: { ...searchContext, source: 'action_assistant' },
                status: 'completed', updatedAt: new Date().toISOString(),
            });

            // Save lead results
            const leads = output.leads || [];
            for (const lead of leads) {
                await db.from('LeadResult').insert({
                    id: crypto.randomUUID(),
                    searchRunId: runId, companyId: auth.companyId,
                    companyName: lead.companyName, industry: lead.industry,
                    whyFit: lead.whyFit, suggestedApproach: lead.suggestedApproach,
                    relevanceScore: 0.8,
                    updatedAt: new Date().toISOString(),
                });
            }

            return {
                success: true,
                resultSummary: output.summary || `Found ${leads.length} potential leads for "${query}"`,
                deepLink: `/sales?tab=leads&searchId=${runId}`,
                inlinePreview: leads.slice(0, 3).map((l: { companyName: string }) => l.companyName).join(', '),
                generatedId: runId,
            };
        } catch (err) {
            console.error('[adapter/leads] Error:', err);
            return { success: false, resultSummary: 'Lead discovery failed', error: String(err) };
        }
    },
};
