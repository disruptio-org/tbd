import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { getAiLanguageName, type Locale } from '@/i18n';
import { retrieveRelevantKnowledge, formatRAGContext } from '@/lib/rag-retrieval';

/* ─── Presentation-specific types ─────────────────────── */
interface PresentationSlide {
    slide_number: number;
    slide_type: string;
    template_id: string;
    title: string;
    subtitle: string;
    body: string;
    bullets: string[];
    data_points: string[];
    speaker_notes: string;
    visual_notes: string;
    layout_instructions: string;
}

interface PresentationOutput {
    title: string;
    objective: string;
    audience: string;
    tone: string;
    slides: PresentationSlide[];
    summary: string;
}

/** Convert parsed presentation JSON into YAML-like string the frontend renderer expects */
function presentationToYaml(p: PresentationOutput): string {
    const esc = (s: string) => (s || '').replace(/"/g, "'").replace(/\n/g, ' ');
    let yaml = 'presentation:\n';
    yaml += '  objective: "' + esc(p.objective) + '"\n';
    yaml += '  audience: "' + esc(p.audience) + '"\n';
    yaml += '  tone: "' + esc(p.tone) + '"\n';
    yaml += '  slides:\n';
    for (const s of p.slides) {
        yaml += '    - slide_number: ' + s.slide_number + '\n';
        yaml += '      slide_type: "' + esc(s.slide_type || 'content') + '"\n';
        yaml += '      template_id: "' + esc(s.template_id || 'default') + '"\n';
        yaml += '      title: "' + esc(s.title) + '"\n';
        yaml += '      subtitle: "' + esc(s.subtitle) + '"\n';
        yaml += '      body: "' + esc(s.body) + '"\n';
        if (s.bullets && s.bullets.length > 0) {
            yaml += '      bullets:\n';
            for (const b of s.bullets) yaml += '        - "' + esc(b) + '"\n';
        }
        if (s.data_points && s.data_points.length > 0) {
            yaml += '      data_points:\n';
            for (const d of s.data_points) yaml += '        - "' + esc(d) + '"\n';
        }
        if (s.speaker_notes) yaml += '      speaker_notes: "' + esc(s.speaker_notes) + '"\n';
        if (s.visual_notes) yaml += '      visual_notes: "' + esc(s.visual_notes) + '"\n';
        if (s.layout_instructions) yaml += '      layout_instructions: "' + esc(s.layout_instructions) + '"\n';
    }
    return yaml;
}

const MODEL = 'gpt-5.4';

// ─── Content-type prompt templates ────────────────────

const CONTENT_TEMPLATES: Record<string, { systemSuffix: string; outputHint: string }> = {
    LINKEDIN_POST: {
        systemSuffix: `Generate a LinkedIn post. Structure: hook (attention-grabbing first line), main body (value, insights, story), CTA (clear call-to-action), hashtags (3-5 relevant).`,
        outputHint: 'hook, body, cta, hashtags',
    },
    WEBSITE_COPY: {
        systemSuffix: `Generate website copy. Structure: headline (clear value prop), subheadline (supporting detail), body (2-3 paragraphs explaining the value), cta (action text).`,
        outputHint: 'headline, subheadline, body, cta',
    },
    BLOG_IDEA: {
        systemSuffix: `Generate blog/article ideas. For each idea provide: title, angle (unique perspective), outline (3-5 key points), targetAudience. Generate 3-5 ideas.`,
        outputHint: 'ideas array with title, angle, outline, targetAudience',
    },
    NEWSLETTER: {
        systemSuffix: `Generate a newsletter draft. Structure: subject (email subject line), preview (preview text), greeting, sections (array of section objects with heading and content), closing, cta.`,
        outputHint: 'subject, preview, greeting, sections, closing, cta',
    },
    CONTENT_PLAN: {
        systemSuffix: `Generate a content plan. Structure: planTitle, timeframe, entries (array with date/slot, topic, angle, audience, format, cta). Generate a practical weekly or monthly plan.`,
        outputHint: 'planTitle, timeframe, entries array',
    },
    CAMPAIGN_IDEA: {
        systemSuffix: `Generate campaign ideas. Structure: campaignName, targetAudience, keyMessage, suggestedChannels (array), contentIdeas (array of ideas), timeline, expectedOutcome.`,
        outputHint: 'campaignName, targetAudience, keyMessage, suggestedChannels, contentIdeas, timeline, expectedOutcome',
    },
    SERVICE_DESCRIPTION: {
        systemSuffix: `Generate a service/product description. Structure: title, tagline, description (2-3 paragraphs), keyBenefits (array), targetAudience, cta.`,
        outputHint: 'title, tagline, description, keyBenefits, targetAudience, cta',
    },
};

/**
 * POST /api/marketing/generate
 * AI-powered marketing content generation with company context.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    try {
        const body = await request.json();
        const {
            contentType,
            topic,
            audience,
            goal,
            tone,
            language,
            length = 'medium',
            callToAction,
            useCompanyContext = true,
            // Refinement fields
            refinementAction,
            previousOutput,
            projectId,
            taskId,
            docIds,
        } = body;

        if (!contentType) {
            return NextResponse.json({ error: 'Content type is required' }, { status: 400 });
        }
        if (!topic?.trim() && !refinementAction) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const openai = new OpenAI({ apiKey });

        // Resolve template: hardcoded OR custom skill from DB OR generic fallback
        let template = CONTENT_TEMPLATES[contentType];
        if (!template) {
            const keyLower = contentType.toLowerCase();

            // Strategy 1: look for skill assigned to MARKETING via SkillAssignment
            const { data: assignments } = await db
                .from('SkillAssignment')
                .select('skillId, skill:AssistantSkill(instructionPrompt, name, description, key, status)')
                .eq('assistantType', 'MARKETING');

            type SkillRow = { instructionPrompt: string | null; name: string; description: string | null; key: string; status: string };
            const assignedSkill = assignments?.find(a => {
                const s = a.skill as unknown as SkillRow;
                return s && s.key.toLowerCase() === keyLower && s.status === 'ACTIVE';
            });

            // Strategy 2: company-specific skills with direct assistantType match
            const { data: directSkills } = await db
                .from('AssistantSkill')
                .select('instructionPrompt, name, description, key')
                .eq('companyId', auth.dbUser.companyId)
                .eq('status', 'ACTIVE');

            const directSkill = directSkills?.find(s => s.key.toLowerCase() === keyLower) || null;

            // Strategy 3: default/seed skills (isDefault=true, any company)
            const { data: defaultSkills } = !directSkill && !assignedSkill ? await db
                .from('AssistantSkill')
                .select('instructionPrompt, name, description, key')
                .eq('isDefault', true)
                .eq('status', 'ACTIVE') : { data: null };

            const defaultSkill = defaultSkills?.find(s => s.key.toLowerCase() === keyLower) || null;

            const customSkill = (assignedSkill?.skill as unknown as SkillRow) || directSkill || defaultSkill;

            if (customSkill) {
                template = {
                    systemSuffix: customSkill.instructionPrompt || `Generate content for: ${customSkill.name}. ${customSkill.description || ''}`,
                    outputHint: 'title, body, cta',
                };
            } else {
                // Generic fallback — use the content type name as-is for generation
                const humanLabel = contentType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                template = {
                    systemSuffix: `Generate professional ${humanLabel} content. Provide a complete, ready-to-use output with all relevant sections. Structure your output clearly with appropriate headings and content blocks.`,
                    outputHint: 'title, body, cta',
                };
            }
        }

        // Fetch effective language: user preference > company language > 'en'
        let companyLang: Locale = 'en';
        {
            const { data: userRow } = await db.from('User').select('language').eq('email', auth.dbUser.email).maybeSingle();
            if (userRow?.language && ['en', 'pt-PT', 'fr'].includes(userRow.language)) {
                companyLang = userRow.language as Locale;
            } else {
                const { data: companyLangRow } = await db.from('Company').select('language').eq('id', auth.dbUser.companyId).maybeSingle();
                if (companyLangRow?.language) companyLang = companyLangRow.language as Locale;
            }
        }
        const effectiveLanguage = language || companyLang;

        // 1. Load company context
        const contextParts: string[] = [];

        if (useCompanyContext) {
            if (projectId) {
                const { data: project } = await db.from('Project').select('name, description, contextText').eq('id', projectId).eq('companyId', auth.dbUser.companyId).maybeSingle();
                if (project) {
                    contextParts.push('=== PROJECT CONTEXT ===');
                    if (project.name) contextParts.push(`Project: ${project.name}`);
                    if (project.description) contextParts.push(`Description: ${project.description}`);
                    if (project.contextText) contextParts.push(`Instructions: ${project.contextText}`);
                }
            } else {
                const { data: profile } = await db
                    .from('CompanyProfile')
                    .select('*')
                    .eq('companyId', auth.dbUser.companyId)
                    .maybeSingle();

                const { data: company } = await db
                    .from('Company')
                    .select('name, website, webContext')
                    .eq('id', auth.dbUser.companyId)
                    .maybeSingle();

                if (profile) {
                    contextParts.push('=== COMPANY PROFILE ===');
                    if (profile.companyName) contextParts.push(`Company: ${profile.companyName}`);
                    if (profile.description) contextParts.push(`Description: ${profile.description}`);
                    if (profile.productsServices) contextParts.push(`Products/Services: ${profile.productsServices}`);
                    if (profile.mainOfferings) contextParts.push(`Main Offerings: ${profile.mainOfferings}`);
                    if (profile.valueProposition) contextParts.push(`Value Proposition: ${profile.valueProposition}`);
                    if (profile.targetCustomers) contextParts.push(`Target Customers: ${profile.targetCustomers}`);
                    if (profile.targetIndustries) contextParts.push(`Target Industries: ${profile.targetIndustries}`);
                    if (profile.markets) contextParts.push(`Markets: ${profile.markets}`);
                    if (profile.competitors) contextParts.push(`Competitors: ${profile.competitors}`);
                    if (profile.strategicGoals) contextParts.push(`Strategic Goals: ${profile.strategicGoals}`);
                } else if (company) {
                    contextParts.push(`Company: ${company.name}`);
                    if (company.website) contextParts.push(`Website: ${company.website}`);
                }

                if (company?.webContext) {
                    contextParts.push(`\nWeb Context:\n${company.webContext}`);
                }
            }
        }

        const companyContext = contextParts.length > 0 ? contextParts.join('\n') : 'No company context available. Generate based on the topic provided.';

        // RAG: Automatically retrieve relevant knowledge from embedded documents
        const ragQuery = [topic, audience, goal].filter(Boolean).join(' — ');
        const ragChunks = ragQuery.trim()
            ? await retrieveRelevantKnowledge(auth.dbUser.companyId, ragQuery, { maxChunks: 8 })
            : [];
        const ragContext = formatRAGContext(ragChunks);

        // Fetch attached document text if docIds provided (from task assignment)
        let docContext = '';
        if (docIds) {
            const docIdArray = typeof docIds === 'string' ? docIds.split(',').filter(Boolean) : [];
            if (docIdArray.length > 0) {
                const { data: docs } = await db
                    .from('Document')
                    .select('filename, extractedText')
                    .in('id', docIdArray)
                    .eq('companyId', auth.dbUser.companyId);
                if (docs && docs.length > 0) {
                    const docTexts = docs
                        .filter(d => d.extractedText)
                        .map(d => `--- ${d.filename} ---\n${d.extractedText}`);
                    if (docTexts.length > 0) {
                        docContext = `\n\n=== ATTACHED DOCUMENTS ===\n${docTexts.join('\n\n')}`;
                    }
                }
            }
        }

        // 2. Build prompt
        const langLabel = getAiLanguageName(effectiveLanguage as Locale);
        const toneLabel = tone || 'professional and clear';
        const audienceLabel = audience || 'B2B professionals';
        const goalLabel = goal || 'inform and engage';
        const lengthMap: Record<string, string> = { short: '100-200 words', medium: '200-400 words', long: '400-800 words' };
        const lengthLabel = lengthMap[length] || lengthMap.medium;

        let userMessage: string;

        if (refinementAction && previousOutput) {
            // Refinement mode
            const actionMap: Record<string, string> = {
                regenerate: 'Generate a completely new version of this content with a fresh approach.',
                rewrite: 'Rewrite this content improving clarity and impact.',
                shorten: 'Shorten this content significantly while keeping the key message.',
                expand: 'Expand this content with more detail, examples, and depth.',
                change_tone: `Rewrite this content in a ${tone || 'more professional'} tone.`,
                adapt_channel: `Adapt this content for a different marketing channel. Make it suitable for ${topic || 'a different format'}.`,
            };
            userMessage = `${actionMap[refinementAction] || 'Refine this content.'}\n\nOriginal content:\n${previousOutput}`;
        } else {
            userMessage = `Topic: ${topic}`;
            if (callToAction) userMessage += `\nDesired CTA: ${callToAction}`;
        }

        const systemPrompt = `You are an AI marketing assistant for a B2B company. Your job is to create clear, useful, and well-structured marketing content.

${companyContext}
${ragContext}${docContext}

CONTENT REQUIREMENTS:
- Content type: ${contentType.replace(/_/g, ' ')}
- Language: ${langLabel}
- Tone: ${toneLabel}
- Target audience: ${audienceLabel}
- Goal: ${goalLabel}
- Approximate length: ${lengthLabel}

${template.systemSuffix}

RULES:
- Write in ${langLabel}.
- Adapt content to the specified audience and tone.
- Use the company context to make content relevant and aligned.
- When company knowledge base sources are available, USE them to enrich your content with real company data, product details, and insights.
- Do NOT invent customer cases, metrics, testimonials, or unsupported claims.
- Be professional, clear, and actionable.
- If company context is limited, generate safe and professional content.`;

        // 3. Call OpenAI — use presentation-specific schema when applicable
        const isPresentation = contentType.toUpperCase().includes('PRESENTATION');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textFormat: any = isPresentation
            ? {
                type: 'json_schema',
                name: 'presentation_content',
                strict: true,
                schema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Presentation title' },
                        objective: { type: 'string', description: 'Presentation objective' },
                        audience: { type: 'string', description: 'Target audience' },
                        tone: { type: 'string', description: 'Presentation tone' },
                        slides: {
                            type: 'array',
                            description: 'Array of presentation slides',
                            items: {
                                type: 'object',
                                properties: {
                                    slide_number: { type: 'number' },
                                    slide_type: { type: 'string', description: 'cover, agenda, content, data, summary, closing' },
                                    template_id: { type: 'string', description: 'Template id like executive-cover, strategy-content, etc.' },
                                    title: { type: 'string' },
                                    subtitle: { type: 'string' },
                                    body: { type: 'string' },
                                    bullets: { type: 'array', items: { type: 'string' } },
                                    data_points: { type: 'array', items: { type: 'string' } },
                                    speaker_notes: { type: 'string' },
                                    visual_notes: { type: 'string' },
                                    layout_instructions: { type: 'string' },
                                },
                                required: ['slide_number', 'slide_type', 'template_id', 'title', 'subtitle', 'body', 'bullets', 'data_points', 'speaker_notes', 'visual_notes', 'layout_instructions'],
                                additionalProperties: false,
                            },
                        },
                        summary: { type: 'string', description: 'One-line summary of the presentation' },
                    },
                    required: ['title', 'objective', 'audience', 'tone', 'slides', 'summary'],
                    additionalProperties: false,
                },
            }
            : {
                type: 'json_schema',
                name: 'marketing_content',
                strict: true,
                schema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Generated title for this content' },
                        content: { type: 'string', description: 'The full generated marketing content as formatted text' },
                        contentStructured: {
                            type: 'object',
                            description: 'Structured breakdown of the content',
                            properties: {
                                hook: { type: 'string' },
                                headline: { type: 'string' },
                                subheadline: { type: 'string' },
                                body: { type: 'string' },
                                cta: { type: 'string' },
                                hashtags: { type: 'string' },
                                sections: { type: 'string' },
                                ideas: { type: 'string' },
                                entries: { type: 'string' },
                            },
                            required: ['hook', 'headline', 'subheadline', 'body', 'cta', 'hashtags', 'sections', 'ideas', 'entries'],
                            additionalProperties: false,
                        },
                        summary: { type: 'string', description: 'One-line summary of what was generated' },
                    },
                    required: ['title', 'content', 'contentStructured', 'summary'],
                    additionalProperties: false,
                },
            };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: systemPrompt,
            input: userMessage,
            temperature: 0.7,
            text: { format: textFormat },
        });

        const rawContent = response.output_text || '';
        let output = { title: '', content: '', contentStructured: {} as Record<string, string>, summary: '' };

        try {
            if (isPresentation) {
                // Parse presentation-specific response and convert to YAML for the frontend renderer
                const presData: PresentationOutput = JSON.parse(rawContent);
                const yamlContent = presentationToYaml(presData);
                output = {
                    title: presData.title || topic || 'Presentation',
                    content: '```yaml\n' + yamlContent + '```',
                    contentStructured: {},
                    summary: presData.summary || '',
                };
            } else {
                output = JSON.parse(rawContent);
            }
        } catch (e) {
            console.error('[marketing/generate] Parse error:', e);
            output = { title: topic || 'Content', content: rawContent, contentStructured: {}, summary: '' };
        }

        // 4. Save generation run
        const runId = crypto.randomUUID();
        const runTitle = output.title || (topic?.substring(0, 80) + (topic?.length > 80 ? '…' : '')) || contentType;

        await db.from('MarketingGenerationRun').insert({
            id: runId,
            companyId: auth.dbUser.companyId,
            userId: auth.dbUser.id,
            contentType,
            title: runTitle,
            inputPrompt: topic || refinementAction || '',
            generationContext: { audience, goal, tone, language, length, callToAction, useCompanyContext, refinementAction },
            outputText: output.content,
            language,
            tone: toneLabel,
            audience: audienceLabel,
            status: 'completed',
            updatedAt: new Date().toISOString(),
        });

        // Link the generation run back to the originating task
        if (taskId) {
            try {
                // Check if there's already an assistant_run link for this task (update it)
                const { data: existingLink } = await db
                    .from('TaskLink')
                    .select('id')
                    .eq('taskId', taskId)
                    .eq('linkType', 'assistant_run')
                    .maybeSingle();

                if (existingLink) {
                    await db.from('TaskLink').update({ entityId: runId }).eq('id', existingLink.id);
                } else {
                    await db.from('TaskLink').insert({
                        id: crypto.randomUUID(),
                        taskId,
                        linkType: 'assistant_run',
                        entityId: runId,
                        label: `MARKETING:${contentType}`,
                    });
                }
            } catch (e) {
                console.error('[marketing/generate] TaskLink upsert error:', e);
            }
        }

        return NextResponse.json({
            generationRunId: runId,
            contentType,
            title: output.title,
            content: output.content,
            contentStructured: output.contentStructured,
            summary: output.summary,
            usedCompanyProfile: useCompanyContext && contextParts.length > 0,
        });

    } catch (error) {
        console.error('[marketing/generate] Error:', error);
        return NextResponse.json({ error: 'Content generation failed', detail: String(error) }, { status: 500 });
    }
}
