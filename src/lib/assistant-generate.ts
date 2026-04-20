import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { getAiLanguageName, type Locale } from '@/i18n';
import { retrieveWikiAndRAGContext } from '@/lib/rag-retrieval';
import { executeSkillRuntime } from '@/lib/skills/runtime/executor';

const MODEL = 'gpt-5.4';

interface AssistantConfig {
    tableName: string;
    systemRole: string;
    contentTypeField: string;
}

const ASSISTANT_CONFIGS: Record<string, AssistantConfig> = {
    ONBOARDING: {
        tableName: 'OnboardingGenerationRun',
        contentTypeField: 'contentType',
        systemRole: `You are an AI Onboarding Assistant. Your job is to create clear, structured, and helpful onboarding content for companies.
You help create welcome guides, training materials, role onboarding plans, FAQ documents, and process documentation for new hires.
Always tailor content to the company's context, culture, and specific needs.`,
    },
    COMPANY_ADVISOR: {
        tableName: 'AdvisorGenerationRun',
        contentTypeField: 'contentType',
        systemRole: `You are an AI Company Advisor. Your job is to provide strategic analysis, market insights, and actionable business recommendations.
You help create strategy briefs, market analyses, competitive analyses, business plans, SWOT analyses, and investment memos.
Always ground your analysis in the company's actual context and market position.`,
    },
    GENERAL_AI: {
        tableName: 'GeneralAIGenerationRun',
        contentTypeField: 'contentType',
        systemRole: `You are a versatile AI Assistant. Your job is to help with research, writing, analysis, and creative tasks.
You help create research summaries, meeting notes, report drafts, professional emails, brainstorming sessions, and document summaries.
Always be clear, structured, and actionable in your outputs.`,
    },
    COMPANY: {
        tableName: 'GeneralAIGenerationRun',
        contentTypeField: 'contentType',
        systemRole: `You are the Company DNA brain — the definitive authority on this company's identity, strategy, culture, and brand voice.
You deeply understand this company's products, market position, values, team structure, and strategic direction.
You help with strategic advice, brand voice checks, team guidance, company briefs, and any question about the company's DNA.
Always ground your responses in the company's actual context. Be authoritative, concise, and actionable.
When asked about strategy, reference the company's strategic goals and market position.
When asked about brand, reference the company's tone, personality traits, and communication style.
When asked about team, reference the AI team structure, roles, and collaboration model.`,
    },
};

export async function handleAssistantGenerate(request: Request, assistantType: string) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    let config = ASSISTANT_CONFIGS[assistantType];

    // Dynamic fallback: load custom brain config from DB
    if (!config) {
        const db = createAdminClient();
        const { data: brain } = await db
            .from('AIBrainProfile')
            .select('name, configJson')
            .eq('brainType', assistantType)
            .maybeSingle();

        if (!brain) return NextResponse.json({ error: 'Invalid assistant type' }, { status: 400 });

        // Extract identity from configJson if available
        const brainConfig = brain.configJson as Record<string, unknown> | null;
        const identity = brainConfig?.identity as Record<string, unknown> | undefined;
        const systemPromptOverride = identity?.systemPrompt as string | undefined;

        config = {
            tableName: 'GeneralAIGenerationRun',      // Reuse general table for custom brains
            contentTypeField: 'contentType',
            systemRole: systemPromptOverride
                || `You are ${brain.name}, an AI assistant. Help users by creating clear, structured, and professional content tailored to the company's needs.`,
        };
    }

    try {
        const body = await request.json();
        const {
            contentType,
            topic,
            audience,
            goal,
            tone,
            language = 'pt-PT',
            length = 'medium',
            refinementAction,
            previousOutput,
            projectId,
        } = body;

        if (!contentType) return NextResponse.json({ error: 'Content type is required' }, { status: 400 });
        if (!topic?.trim() && !refinementAction) return NextResponse.json({ error: 'Topic is required' }, { status: 400 });

        const db = createAdminClient();

        // ── Runtime dispatch: try the new executor for non-LEGACY skills ──
        if (!refinementAction) {
            const skillKey = contentType.toLowerCase();
            const { data: skillRow } = await db
                .from('AssistantSkill')
                .select('id, importMode, runtimeCategory')
                .eq('companyId', auth.dbUser.companyId)
                .eq('key', skillKey)
                .eq('status', 'ACTIVE')
                .maybeSingle();

            if (skillRow && skillRow.importMode && skillRow.importMode !== 'LEGACY' && skillRow.runtimeCategory !== 'content-generation') {
                try {
                    const runtimeResult = await executeSkillRuntime({
                        companyId: auth.dbUser.companyId,
                        userId: auth.dbUser.id,
                        skillId: skillRow.id,
                        topic: topic || '',
                        language,
                        audience,
                        tone,
                        goal,
                        length,
                        projectId,
                    });

                    // If the executor handled the skill (non-null), return its result
                    if (runtimeResult) {
                        return NextResponse.json({
                            generationRunId: runtimeResult.executionTrace?.steps?.[0]?.data?.runId || crypto.randomUUID(),
                            contentType,
                            title: runtimeResult.assistantMessage?.substring(0, 200) || topic?.substring(0, 80) || contentType,
                            content: runtimeResult.assistantMessage || '',
                            contentStructured: {},
                            summary: runtimeResult.assistantMessage?.substring(0, 100) || '',
                            usedCompanyProfile: true,
                            // Runtime extensions
                            resultEnvelope: runtimeResult,
                            artifacts: runtimeResult.artifacts,
                            responseMode: runtimeResult.responseMode,
                            executionMeta: runtimeResult.executionMeta,
                        });
                    }
                    // null = fallthrough to existing pipeline
                } catch (runtimeErr) {
                    console.warn('[assistant-generate] Runtime executor failed, falling back to legacy pipeline:', runtimeErr);
                }
            }
        }
        const openai = new OpenAI({ apiKey });

        // Fetch company language
        const { data: companyLangRow } = await db.from('Company').select('language').eq('id', auth.dbUser.companyId).maybeSingle();
        const companyLang = (companyLangRow?.language as Locale) || 'en';
        const effectiveLanguage = language || companyLang;

        // Load company context
        const contextParts: string[] = [];
        if (projectId) {
            const { data: project } = await db.from('Project').select('name, description, contextText').eq('id', projectId).eq('companyId', auth.dbUser.companyId).maybeSingle();
            if (project) {
                contextParts.push('=== PROJECT CONTEXT ===');
                if (project.name) contextParts.push(`Project: ${project.name}`);
                if (project.description) contextParts.push(`Description: ${project.description}`);
                if (project.contextText) contextParts.push(`Instructions: ${project.contextText}`);
            }
        } else {
            const { data: profile } = await db.from('CompanyProfile').select('*').eq('companyId', auth.dbUser.companyId).maybeSingle();
            const { data: company } = await db.from('Company').select('name, website, webContext').eq('id', auth.dbUser.companyId).maybeSingle();

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
                if (profile.departments) contextParts.push(`Departments: ${profile.departments}`);
                if (profile.internalTools) contextParts.push(`Internal Tools: ${profile.internalTools}`);
                if (profile.keyProcesses) contextParts.push(`Key Processes: ${profile.keyProcesses}`);
            } else if (company) {
                contextParts.push(`Company: ${company.name}`);
                if (company.website) contextParts.push(`Website: ${company.website}`);
            }
            if (company?.webContext) contextParts.push(`\nWeb Context:\n${company.webContext}`);
        }

        const companyContext = contextParts.length > 0 ? contextParts.join('\n') : 'No company context available.';

        // ── Enrich Company DNA brain with identity + team structure ──
        if (assistantType === 'COMPANY') {
            const { data: dnaBrain } = await db
                .from('AIBrainProfile')
                .select('configJson')
                .eq('companyId', auth.dbUser.companyId)
                .eq('brainType', 'COMPANY')
                .maybeSingle();

            if (dnaBrain?.configJson) {
                const cfg = dnaBrain.configJson as Record<string, unknown>;
                const identity = cfg.identity as Record<string, unknown> | undefined;
                if (identity) {
                    contextParts.push('\n=== COMPANY DNA IDENTITY ===');
                    if (identity.tonePreset) contextParts.push(`Tone: ${String(identity.tonePreset).replace(/_/g, ' ')}`);
                    if (identity.communicationStyle) contextParts.push(`Communication Style: ${identity.communicationStyle}`);
                    if (Array.isArray(identity.personalityTraits) && identity.personalityTraits.length > 0) {
                        contextParts.push(`Personality Traits: ${identity.personalityTraits.join(', ')}`);
                    }
                }

                const ts = cfg.teamStructure as Record<string, string> | undefined;
                if (ts) {
                    contextParts.push('\n=== TEAM STRUCTURE ===');
                    if (ts.operatingModel) contextParts.push(`Operating Model: ${ts.operatingModel}`);
                    if (ts.collaborationModel) contextParts.push(`Collaboration Model: ${ts.collaborationModel}`);
                }
            }

            // Load team member names
            const { data: teamBrains } = await db
                .from('AIBrainProfile')
                .select('brainType, name')
                .eq('companyId', auth.dbUser.companyId)
                .neq('brainType', 'COMPANY');

            if (teamBrains && teamBrains.length > 0) {
                contextParts.push(`\nTeam Members: ${teamBrains.map(b => b.name).join(', ')}`);
            }
        }

        // Wiki-first + RAG retrieval
        const ragQuery = [topic, audience, goal].filter(Boolean).join(' — ');
        const { context: wikiRagContext } = ragQuery.trim()
            ? await retrieveWikiAndRAGContext(auth.dbUser.companyId, ragQuery, { maxRagChunks: 8 })
            : { context: '' };
        const ragContext = wikiRagContext;

        // Build prompt
        const langLabel = getAiLanguageName(effectiveLanguage as Locale);
        const toneLabel = tone || 'professional and clear';
        const audienceLabel = audience || 'general audience';
        const goalLabel = goal || 'inform and assist';
        const lengthMap: Record<string, string> = { short: '100-200 words', medium: '200-400 words', long: '400-800 words' };
        const lengthLabel = lengthMap[length] || lengthMap.medium;

        // ── Fetch skill-specific instruction prompt from DB ──
        let skillInstructionPrompt = '';
        {
            const skillKey = contentType.toLowerCase();
            const { data: skill } = await db
                .from('AssistantSkill')
                .select('instructionPrompt, requiredInputs, defaultParams')
                .eq('companyId', auth.dbUser.companyId)
                .eq('key', skillKey)
                .eq('status', 'ACTIVE')
                .maybeSingle();
            if (skill?.instructionPrompt) {
                let prompt = skill.instructionPrompt;

                // ── Phase 1B: $ARGUMENTS substitution ──
                // $ARGUMENTS → full topic, $ARGUMENTS[0]/$0 → first word-arg, etc.
                const args = (topic || '').split(/\s+/).filter(Boolean);
                prompt = prompt.replace(/\$ARGUMENTS\[(\d+)\]/g, (_: string, i: string) => args[parseInt(i)] || '');
                prompt = prompt.replace(/\$(\d+)/g, (_: string, i: string) => args[parseInt(i)] || '');
                prompt = prompt.replace(/\$ARGUMENTS/g, topic || '');

                // ── Phase 2: Dynamic context injection ──
                // Resolve !{PLACEHOLDER} tokens with company data
                if (prompt.includes('!{')) {
                    // Fetch company profile once if needed
                    const { data: cp } = await db.from('CompanyProfile')
                        .select('productsServices, mainOfferings, valueProposition, targetCustomers, strategicGoals, targetIndustries, competitors')
                        .eq('companyId', auth.dbUser.companyId).maybeSingle();

                    const placeholderMap: Record<string, string> = {
                        'COMPANY_PRODUCTS': cp?.productsServices || cp?.mainOfferings || 'No products data available',
                        'COMPANY_OFFERINGS': cp?.mainOfferings || cp?.productsServices || 'No offerings data available',
                        'COMPANY_VALUE_PROP': cp?.valueProposition || 'No value proposition available',
                        'COMPANY_CUSTOMERS': cp?.targetCustomers || 'No customer data available',
                        'COMPANY_GOALS': cp?.strategicGoals || 'No strategic goals available',
                        'COMPANY_INDUSTRIES': cp?.targetIndustries || 'No industry data available',
                        'COMPANY_COMPETITORS': cp?.competitors || 'No competitor data available',
                    };

                    // Resolve recent documents if requested
                    if (prompt.includes('!{RECENT_DOCS}') || prompt.includes('!{RECENT_DOCUMENTS}')) {
                        const { data: recentDocs } = await db.from('CompanyDocument')
                            .select('name, description')
                            .eq('companyId', auth.dbUser.companyId)
                            .order('createdAt', { ascending: false })
                            .limit(10);
                        const docList = recentDocs?.map(d => `- ${d.name}${d.description ? ': ' + d.description : ''}`).join('\n') || 'No recent documents';
                        placeholderMap['RECENT_DOCS'] = docList;
                        placeholderMap['RECENT_DOCUMENTS'] = docList;
                    }

                    // Resolve team notes if requested
                    if (prompt.includes('!{TEAM_NOTES}')) {
                        const { data: notes } = await db.from('GeneralAIGenerationRun')
                            .select('title, outputText')
                            .eq('companyId', auth.dbUser.companyId)
                            .order('createdAt', { ascending: false })
                            .limit(5);
                        const noteList = notes?.map(n => `## ${n.title}\n${(n.outputText || '').substring(0, 500)}`).join('\n\n') || 'No recent notes';
                        placeholderMap['TEAM_NOTES'] = noteList;
                    }

                    // Replace all !{TOKEN} placeholders
                    prompt = prompt.replace(/!\{([A-Z_]+)\}/g, (_m: string, key: string) => placeholderMap[key] || `[${key} not available]`);
                }

                // ── Apply default params from skill config ──
                if (skill.defaultParams && typeof skill.defaultParams === 'object') {
                    const defaults = skill.defaultParams as Record<string, string>;
                    if (defaults.tone && !tone) Object.assign(body, { tone: defaults.tone });
                    if (defaults.audience && !audience) Object.assign(body, { audience: defaults.audience });
                    if (defaults.length && !length) Object.assign(body, { length: defaults.length });
                }

                skillInstructionPrompt = prompt;
            }
        }

        let userMessage: string;
        if (refinementAction && previousOutput) {
            const actionMap: Record<string, string> = {
                regenerate: 'Generate a completely new version with a fresh approach.',
                rewrite: 'Rewrite improving clarity and impact.',
                shorten: 'Shorten significantly while keeping the key message.',
                expand: 'Expand with more detail, examples, and depth.',
                change_tone: `Rewrite in a ${tone || 'more professional'} tone.`,
            };
            userMessage = `${actionMap[refinementAction] || 'Refine this content.'}\n\nOriginal content:\n${previousOutput}`;
        } else {
            userMessage = `Topic: ${topic}`;
        }

        const baseRole = skillInstructionPrompt
            ? `${config.systemRole}\n\n=== SKILL-SPECIFIC INSTRUCTIONS ===\n${skillInstructionPrompt}`
            : config.systemRole;

        const systemPrompt = `${baseRole}

${companyContext}
${ragContext}

REQUIREMENTS:
- Content type: ${contentType.replace(/_/g, ' ')}
- Language: ${langLabel}
- Tone: ${toneLabel}
- Target audience: ${audienceLabel}
- Goal: ${goalLabel}
- Approximate length: ${lengthLabel}

RULES:
- Write in ${langLabel}.
- Adapt content to the specified audience and tone.
- Use the company context to make content relevant and aligned.
- When company knowledge base sources are available, USE them to enrich your content.
- When web search results are available, USE them to provide current, factual information with source links.
- Do NOT invent unsupported claims.
- Be professional, clear, and actionable.`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: systemPrompt,
            input: userMessage,
            tools: [{ type: 'web_search_preview' }],
            temperature: 0.7,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'assistant_content',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Generated title' },
                            content: { type: 'string', description: 'The full generated content as formatted text. Include source URLs as markdown links when web search was used.' },
                            contentStructured: {
                                type: 'object',
                                description: 'Structured breakdown',
                                properties: {
                                    hook: { type: 'string' },
                                    headline: { type: 'string' },
                                    body: { type: 'string' },
                                    sections: { type: 'string' },
                                },
                                required: ['hook', 'headline', 'body', 'sections'],
                                additionalProperties: false,
                            },
                            summary: { type: 'string', description: 'One-line summary' },
                        },
                        required: ['title', 'content', 'contentStructured', 'summary'],
                        additionalProperties: false,
                    },
                },
            },
        });

        const rawContent = response.output_text || '';
        let output = { title: '', content: '', contentStructured: {} as Record<string, string>, summary: '' };
        try { output = JSON.parse(rawContent); } catch { output = { title: topic || 'Content', content: rawContent, contentStructured: {}, summary: '' }; }

        // Save generation run
        const runId = crypto.randomUUID();
        await db.from(config.tableName).insert({
            id: runId,
            companyId: auth.dbUser.companyId,
            userId: auth.dbUser.id,
            contentType,
            title: output.title || topic?.substring(0, 80) || contentType,
            inputPrompt: topic || refinementAction || '',
            generationContext: { audience, goal, tone, language, length, refinementAction },
            outputText: output.content,
            language,
            status: 'completed',
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
            generationRunId: runId,
            contentType,
            title: output.title,
            content: output.content,
            contentStructured: output.contentStructured,
            summary: output.summary,
            usedCompanyProfile: contextParts.length > 0,
        });
    } catch (error) {
        console.error(`[${assistantType}/generate] Error:`, error);
        return NextResponse.json({ error: 'Content generation failed', detail: String(error) }, { status: 500 });
    }
}
