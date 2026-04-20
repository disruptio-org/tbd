/**
 * Marketing module adapter.
 * Wraps POST /api/marketing/generate to create marketing content.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { retrieveWikiAndRAGContext } from '@/lib/rag-retrieval';
import type { ModuleAdapter, AuthContext, AdapterResult } from './types';

const MODEL = 'gpt-5.4';

const CONTENT_TYPES = ['LINKEDIN_POST', 'WEBSITE_COPY', 'BLOG_IDEA', 'NEWSLETTER', 'CONTENT_PLAN', 'CAMPAIGN_IDEA', 'SERVICE_DESCRIPTION'];

export const marketingAdapter: ModuleAdapter = {
    name: 'marketing',
    requiredParams: ['contentType', 'topic'],
    optionalParams: ['audience', 'tone', 'goal', 'length', 'projectName'],

    async execute(params: Record<string, unknown>, auth: AuthContext): Promise<AdapterResult> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { success: false, resultSummary: 'OpenAI API key not configured', error: 'OPENAI_API_KEY missing' };

        const contentType = String(params.contentType || 'LINKEDIN_POST').toUpperCase().replace(/\s+/g, '_');

        const db = createAdminClient();
        const openai = new OpenAI({ apiKey });
        const topic = String(params.topic || '');
        const audience = String(params.audience || 'B2B professionals');
        const tone = String(params.tone || 'professional and clear');
        const goal = String(params.goal || 'inform and engage');

        // Resolve custom skill instructions if not a built-in type
        let customSkillInstructions = '';
        if (!CONTENT_TYPES.includes(contentType)) {
            const { data: customSkill } = await db
                .from('AssistantSkill')
                .select('instructionPrompt, name, description')
                .eq('companyId', auth.companyId)
                .ilike('key', contentType.toLowerCase())
                .eq('status', 'ACTIVE')
                .maybeSingle();

            if (!customSkill) {
                return { success: false, resultSummary: `Unsupported content type: ${contentType}`, error: 'Invalid content type' };
            }
            customSkillInstructions = customSkill.instructionPrompt || `Generate content for: ${customSkill.name}. ${customSkill.description || ''}`;
        }

        try {
            // Load company context
            const { data: profile } = await db.from('CompanyProfile').select('*').eq('companyId', auth.companyId).maybeSingle();
            const { data: company } = await db.from('Company').select('name, website, webContext').eq('id', auth.companyId).maybeSingle();

            const contextParts: string[] = [];
            if (profile) {
                contextParts.push('=== COMPANY PROFILE ===');
                if (profile.companyName) contextParts.push(`Company: ${profile.companyName}`);
                if (profile.description) contextParts.push(`Description: ${profile.description}`);
                if (profile.valueProposition) contextParts.push(`Value Proposition: ${profile.valueProposition}`);
                if (profile.targetCustomers) contextParts.push(`Target Customers: ${profile.targetCustomers}`);
            } else if (company) {
                contextParts.push(`Company: ${company.name}`);
            }
            if (company?.webContext) contextParts.push(`\nWeb Context:\n${company.webContext}`);

            // Project-specific context
            const projectName = params.projectName ? String(params.projectName) : null;
            if (projectName) {
                const { data: projects } = await db.from('Project').select('name, description, contextText').eq('companyId', auth.companyId);
                if (projects) {
                    const normalized = projectName.toLowerCase().trim();
                    const match = projects.find(p =>
                        p.name?.toLowerCase().includes(normalized)
                        || normalized.includes(p.name?.toLowerCase() || '')
                    );
                    if (match) {
                        contextParts.push('\n=== PROJECT DOCUMENTATION ===');
                        contextParts.push(`Project: ${match.name}`);
                        if (match.description) contextParts.push(`Description: ${match.description}`);
                        if (match.contextText) contextParts.push(`\nProject Context:\n${match.contextText}`);
                    }
                }
            }

            // RAG
            const { context: wikiRagContext, groundingLevel } = topic
                ? await retrieveWikiAndRAGContext(auth.companyId, topic, { projectId: auth.projectId })
                : { context: '', groundingLevel: 'NOT_FOUND' as const };
            const ragContext = wikiRagContext;

            const systemPrompt = `You are a marketing content generator. Create ${contentType.replace(/_/g, ' ')} content.
${contextParts.join('\n')}
${ragContext}
${customSkillInstructions ? `\nSKILL-SPECIFIC INSTRUCTIONS:\n${customSkillInstructions}\n` : ''}
Tone: ${tone}. Audience: ${audience}. Goal: ${goal}.
IMPORTANT: Always generate content in English, regardless of the language of the source data. Only use another language if the user explicitly requests it.
Write clear, professional content. Return JSON: { "title": "...", "content": "...", "summary": "one-line summary" }`;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (openai as any).responses.create({
                model: MODEL,
                instructions: systemPrompt,
                input: `Topic: ${topic}`,
                temperature: 0.7,
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'marketing_output',
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

            // Save generation run
            const runId = crypto.randomUUID();
            await db.from('MarketingGenerationRun').insert({
                id: runId, companyId: auth.companyId, userId: auth.userId,
                contentType, title: output.title || topic,
                inputPrompt: topic, outputText: output.content,
                generationContext: { audience, goal, tone, source: 'action_assistant' },
                status: 'completed', updatedAt: new Date().toISOString(),
            });

            return {
                success: true,
                resultSummary: output.summary || `Generated ${contentType.replace(/_/g, ' ').toLowerCase()}: "${output.title}"`,
                deepLink: `/marketing?runId=${runId}`,
                inlinePreview: (output.content || '').substring(0, 200) + '…',
                groundingStatus: groundingLevel,
                generatedId: runId,
            };
        } catch (err) {
            console.error('[adapter/marketing] Error:', err);
            return { success: false, resultSummary: 'Marketing content generation failed', error: String(err) };
        }
    },
};
