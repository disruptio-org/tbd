import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { getAiLanguageName, type Locale } from '@/i18n';
import { retrieveRelevantKnowledge, formatRAGContext } from '@/lib/rag-retrieval';

const MODEL = 'gpt-5.4';

// ─── Task-type prompt templates ───────────────────────

const TASK_TEMPLATES: Record<string, { systemSuffix: string }> = {
    OUTREACH_EMAIL: {
        systemSuffix: `Generate a B2B outreach email. Structure: subject (email subject line), greeting, body (main email text, 2-3 paragraphs), cta (clear call-to-action), shortVariant (a shorter 2-sentence version of the same email).`,
    },
    LINKEDIN_MESSAGE: {
        systemSuffix: `Generate a LinkedIn outreach message. Structure: shortMessage (concise, natural, max 300 chars), expandedMessage (slightly longer, 2-3 short paragraphs), followUpMessage (a follow-up if no reply).`,
    },
    DISCOVERY_CALL_PLAN: {
        systemSuffix: `Generate a discovery call preparation plan. Structure: objective (call objective), hypotheses (what you think the prospect needs), keyQuestions (5-8 questions to ask), likelyPainPoints (3-5 pain points), nextStepGoal (what the ideal next step would be), talkingPoints (key things to mention about our offer).`,
    },
    PROPOSAL_OUTLINE: {
        systemSuffix: `Generate a proposal outline. Structure: executiveSummary, clientChallenge, proposedSolution, expectedValue, suggestedScope, nextSteps.`,
    },
    PROPOSAL_DRAFT: {
        systemSuffix: `Generate a full proposal draft. Structure: title, executiveSummary (2-3 paragraphs), situationAnalysis (prospect context), challenge (identified needs), solution (what we propose, 3-4 paragraphs), expectedOutcomes (bullet points), approach (how we work), nextSteps. Do NOT invent pricing, timelines, or specific commitments unless provided.`,
    },
    FOLLOW_UP_EMAIL: {
        systemSuffix: `Generate a follow-up email. Structure: subject, greeting, body (reference the previous interaction, add value, propose next step), cta, shortVariant (shorter version).`,
    },
    OBJECTION_HANDLING: {
        systemSuffix: `Generate objection handling guidance. Structure: objection (the stated objection), recommendedResponse (what to say), reframingAngle (how to reposition the conversation), followUpQuestion (a question to keep the dialogue open), shortVersion (a brief 1-2 sentence response).`,
    },
    BUYER_SPECIFIC_PITCH: {
        systemSuffix: `Generate a pitch tailored to the specific buyer role. Structure: buyerRole, keyValueAngle (what matters most to this role), painFraming (how to frame the problem for this role), positioningStatement (1 paragraph pitch), suggestedCTA, adaptationNotes (tips for this buyer type).`,
    },
    MEETING_PREP_NOTES: {
        systemSuffix: `Generate meeting preparation notes. Structure: meetingObjective, attendeeContext (who we're meeting and what they care about), keyTopics (3-5 topics to cover), questionsToAsk (3-5 questions), thingsToAvoid (pitfalls), desiredOutcome, materialsToHave.`,
    },
    SALES_SUMMARY: {
        systemSuffix: `Generate a sales summary for the prospect. Structure: prospectOverview, whyTheyFit, identifiedNeeds, ourRelevantOffer, suggestedApproach, keyRisks, recommendedNextAction.`,
    },
};

/**
 * POST /api/sales/generate
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    try {
        const body = await request.json();
        const {
            taskType,
            prospectCompanyName,
            prospectWebsite,
            prospectIndustry,
            prospectLocation,
            buyerRole,
            objective,
            painOpportunity,
            offerToPosition,
            tone,
            language,
            length = 'medium',
            callToAction,
            useCompanyContext = true,
            refinementAction,
            previousOutput,
            projectId,
        } = body;

        if (!taskType) {
            return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
        }
        if (!objective?.trim() && !refinementAction) {
            return NextResponse.json({ error: 'Objective is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const openai = new OpenAI({ apiKey });

        // Resolve template: prefer hardcoded templates, then fall back to DB skill instructionPrompt
        let template = TASK_TEMPLATES[taskType];
        if (!template) {
            // Look up the skill in the DB for this company (or default skills)
            const { data: dbSkill } = await db
                .from('AssistantSkill')
                .select('instructionPrompt, name')
                .eq('key', taskType.toLowerCase())
                .or(`companyId.eq.${auth.dbUser.companyId},isDefault.eq.true`)
                .in('status', ['ACTIVE', 'DRAFT'])
                .maybeSingle();

            if (!dbSkill?.instructionPrompt) {
                return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
            }
            template = { systemSuffix: dbSkill.instructionPrompt };
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
        const ctxParts: string[] = [];

        if (useCompanyContext) {
            if (projectId) {
                const { data: project } = await db.from('Project').select('name, description, contextText').eq('id', projectId).eq('companyId', auth.dbUser.companyId).maybeSingle();
                if (project) {
                    ctxParts.push('=== PROJECT CONTEXT ===');
                    if (project.name) ctxParts.push(`Project: ${project.name}`);
                    if (project.description) ctxParts.push(`Description: ${project.description}`);
                    if (project.contextText) ctxParts.push(`Instructions: ${project.contextText}`);
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
                    ctxParts.push('=== YOUR COMPANY ===');
                    if (profile.companyName) ctxParts.push(`Company: ${profile.companyName}`);
                    if (profile.description) ctxParts.push(`Description: ${profile.description}`);
                    if (profile.productsServices) ctxParts.push(`Products/Services: ${profile.productsServices}`);
                    if (profile.mainOfferings) ctxParts.push(`Main Offerings: ${profile.mainOfferings}`);
                    if (profile.valueProposition) ctxParts.push(`Value Proposition: ${profile.valueProposition}`);
                    if (profile.targetCustomers) ctxParts.push(`Target Customers: ${profile.targetCustomers}`);
                    if (profile.targetIndustries) ctxParts.push(`Target Industries: ${profile.targetIndustries}`);
                    if (profile.markets) ctxParts.push(`Markets: ${profile.markets}`);
                    if (profile.competitors) ctxParts.push(`Competitors: ${profile.competitors}`);
                } else if (company) {
                    ctxParts.push(`Company: ${company.name}`);
                    if (company.website) ctxParts.push(`Website: ${company.website}`);
                }
            }
        }

        // 2. Build prospect context
        const prospectParts: string[] = [];
        if (prospectCompanyName || prospectIndustry || prospectLocation || buyerRole) {
            prospectParts.push('=== PROSPECT ===');
            if (prospectCompanyName) prospectParts.push(`Company: ${prospectCompanyName}`);
            if (prospectWebsite) prospectParts.push(`Website: ${prospectWebsite}`);
            if (prospectIndustry) prospectParts.push(`Industry: ${prospectIndustry}`);
            if (prospectLocation) prospectParts.push(`Location: ${prospectLocation}`);
            if (buyerRole) prospectParts.push(`Buyer Role: ${buyerRole}`);
            if (painOpportunity) prospectParts.push(`Pain / Opportunity: ${painOpportunity}`);
        }

        const companyContext = ctxParts.length > 0 ? ctxParts.join('\n') : 'No company context. Use the provided inputs.';
        const prospectContext = prospectParts.length > 0 ? prospectParts.join('\n') : '';

        // RAG: Automatically retrieve relevant knowledge from embedded documents
        const ragQuery = [objective, prospectCompanyName, prospectIndustry, offerToPosition].filter(Boolean).join(' — ');
        const ragChunks = ragQuery.trim()
            ? await retrieveRelevantKnowledge(auth.dbUser.companyId, ragQuery, { maxChunks: 8 })
            : [];
        const ragContext = formatRAGContext(ragChunks);

        // 3. Build prompt
        const langLabel = getAiLanguageName(effectiveLanguage as Locale);
        const toneLabel = tone || 'professional and consultative';
        const buyerLabel = buyerRole || 'decision-maker';
        const lengthMap: Record<string, string> = { short: '100-200 words', medium: '200-400 words', long: '400-800 words' };
        const lengthLabel = lengthMap[length] || lengthMap.medium;

        let userMessage: string;
        if (refinementAction && previousOutput) {
            const actionMap: Record<string, string> = {
                regenerate: 'Generate a completely new version with a fresh approach.',
                rewrite: 'Rewrite improving clarity and impact.',
                shorten: 'Shorten significantly while keeping the key message.',
                expand: 'Expand with more detail and depth.',
                change_tone: `Rewrite in a ${tone || 'more professional'} tone.`,
                more_persuasive: 'Rewrite to be more persuasive and compelling.',
                adapt_role: `Adapt this for a ${buyerRole || 'different buyer role'}.`,
            };
            userMessage = `${actionMap[refinementAction] || 'Refine this content.'}\n\nOriginal content:\n${previousOutput}`;
        } else {
            userMessage = `Objective: ${objective}`;
            if (offerToPosition) userMessage += `\nOffer to position: ${offerToPosition}`;
            if (callToAction) userMessage += `\nDesired CTA: ${callToAction}`;
        }

        const systemPrompt = `You are an AI sales assistant for a B2B company. Help prepare outreach, proposals, follow-ups, discovery conversations, and sales messaging.

${companyContext}
${ragContext}

${prospectContext}

TASK REQUIREMENTS:
- Task: ${taskType.replace(/_/g, ' ')}
- Language: ${langLabel}
- Tone: ${toneLabel}
- Target buyer: ${buyerLabel}
- Length: ${lengthLabel}

${template.systemSuffix}

RULES:
- Write in ${langLabel}.
- Tailor output to the specific prospect and buyer role.
- Use company context to align messaging.
- When company knowledge base sources are available, USE them to enrich your messaging with real company data, product details, case studies, and differentiators.
- Do NOT invent customer cases, ROI claims, pricing, timelines, or unsupported facts.
- Be professional, specific, and actionable.
- If context is limited, generate safe professional content.`;

        // 4. Call OpenAI
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: systemPrompt,
            input: userMessage,
            temperature: 0.7,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'sales_output',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Generated title' },
                            content: { type: 'string', description: 'Full generated sales content as text' },
                            contentStructured: {
                                type: 'object',
                                description: 'Structured breakdown',
                                properties: {
                                    subject: { type: 'string' },
                                    greeting: { type: 'string' },
                                    body: { type: 'string' },
                                    cta: { type: 'string' },
                                    shortVariant: { type: 'string' },
                                    shortMessage: { type: 'string' },
                                    expandedMessage: { type: 'string' },
                                    followUpMessage: { type: 'string' },
                                    objective: { type: 'string' },
                                    hypotheses: { type: 'string' },
                                    keyQuestions: { type: 'string' },
                                    likelyPainPoints: { type: 'string' },
                                    nextStepGoal: { type: 'string' },
                                    talkingPoints: { type: 'string' },
                                    executiveSummary: { type: 'string' },
                                    clientChallenge: { type: 'string' },
                                    proposedSolution: { type: 'string' },
                                    expectedValue: { type: 'string' },
                                    suggestedScope: { type: 'string' },
                                    nextSteps: { type: 'string' },
                                    objection: { type: 'string' },
                                    recommendedResponse: { type: 'string' },
                                    reframingAngle: { type: 'string' },
                                    followUpQuestion: { type: 'string' },
                                    shortVersion: { type: 'string' },
                                    buyerRole: { type: 'string' },
                                    keyValueAngle: { type: 'string' },
                                    painFraming: { type: 'string' },
                                    positioningStatement: { type: 'string' },
                                    suggestedCTA: { type: 'string' },
                                    adaptationNotes: { type: 'string' },
                                    meetingObjective: { type: 'string' },
                                    attendeeContext: { type: 'string' },
                                    keyTopics: { type: 'string' },
                                    questionsToAsk: { type: 'string' },
                                    thingsToAvoid: { type: 'string' },
                                    desiredOutcome: { type: 'string' },
                                    materialsToHave: { type: 'string' },
                                    prospectOverview: { type: 'string' },
                                    whyTheyFit: { type: 'string' },
                                    identifiedNeeds: { type: 'string' },
                                    ourRelevantOffer: { type: 'string' },
                                    suggestedApproach: { type: 'string' },
                                    keyRisks: { type: 'string' },
                                    recommendedNextAction: { type: 'string' },
                                },
                                required: ['subject', 'greeting', 'body', 'cta', 'shortVariant', 'shortMessage', 'expandedMessage', 'followUpMessage', 'objective', 'hypotheses', 'keyQuestions', 'likelyPainPoints', 'nextStepGoal', 'talkingPoints', 'executiveSummary', 'clientChallenge', 'proposedSolution', 'expectedValue', 'suggestedScope', 'nextSteps', 'objection', 'recommendedResponse', 'reframingAngle', 'followUpQuestion', 'shortVersion', 'buyerRole', 'keyValueAngle', 'painFraming', 'positioningStatement', 'suggestedCTA', 'adaptationNotes', 'meetingObjective', 'attendeeContext', 'keyTopics', 'questionsToAsk', 'thingsToAvoid', 'desiredOutcome', 'materialsToHave', 'prospectOverview', 'whyTheyFit', 'identifiedNeeds', 'ourRelevantOffer', 'suggestedApproach', 'keyRisks', 'recommendedNextAction'],
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

        try {
            output = JSON.parse(rawContent);
        } catch (e) {
            console.error('[sales/generate] Parse error:', e);
            output = { title: objective || 'Sales Content', content: rawContent, contentStructured: {}, summary: '' };
        }

        // 5. Save run
        const runId = crypto.randomUUID();
        const runTitle = output.title || objective?.substring(0, 80) || taskType;

        await db.from('SalesGenerationRun').insert({
            id: runId,
            companyId: auth.dbUser.companyId,
            userId: auth.dbUser.id,
            taskType,
            title: runTitle,
            inputPrompt: objective || refinementAction || '',
            generationContext: { prospectCompanyName, prospectIndustry, prospectLocation, buyerRole, tone, language, length, callToAction, useCompanyContext, refinementAction },
            outputText: output.content,
            language,
            tone: toneLabel,
            buyerRole: buyerLabel,
            prospectCompanyName: prospectCompanyName || null,
            status: 'completed',
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
            generationRunId: runId,
            taskType,
            title: output.title,
            content: output.content,
            contentStructured: output.contentStructured,
            summary: output.summary,
            usedCompanyProfile: useCompanyContext && ctxParts.length > 0,
        });

    } catch (error) {
        console.error('[sales/generate] Error:', error);
        return NextResponse.json({ error: 'Sales generation failed', detail: String(error) }, { status: 500 });
    }
}
