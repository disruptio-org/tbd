import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const MODEL = 'gpt-5.4';

/* ─── Field schemas per assistant type ───────────────── */

const FIELD_SCHEMAS = {
    MARKETING: {
        required: ['contentType', 'topic'],
        optional: ['audience', 'goal', 'tone', 'language', 'length', 'callToAction'],
        descriptions: {
            contentType: 'Type of content — choose the BEST one: LINKEDIN_POST | WEBSITE_COPY | BLOG_IDEA | NEWSLETTER | CONTENT_PLAN | CAMPAIGN_IDEA | SERVICE_DESCRIPTION',
            topic: 'The main topic or prompt for the content',
            audience: 'Target audience (e.g. "SMB CEOs in Portugal")',
            goal: 'What the content should achieve (e.g. "educate and generate interest")',
            tone: 'Writing tone: Professional | Simple | Consultative | Educational | Confident | Approachable | Executive | Persuasive',
            language: 'Output language: en | pt-PT | fr (uses company language if not specified)',
            length: 'Content length: short | medium | long (default: medium)',
            callToAction: 'Optional: the call to action text',
        },
    },
    SALES: {
        required: ['taskType', 'objective'],
        optional: ['prospectCompanyName', 'prospectWebsite', 'prospectIndustry', 'prospectLocation', 'buyerRole', 'painOpportunity', 'offerToPosition', 'tone', 'language', 'length', 'callToAction'],
        descriptions: {
            taskType: 'Type of sales content — choose the BEST one: OUTREACH_EMAIL | LINKEDIN_MESSAGE | DISCOVERY_CALL_PLAN | PROPOSAL_OUTLINE | PROPOSAL_DRAFT | FOLLOW_UP_EMAIL | OBJECTION_HANDLING | BUYER_SPECIFIC_PITCH | MEETING_PREP_NOTES | SALES_SUMMARY',
            objective: 'Main sales objective',
            prospectCompanyName: 'Prospect company name',
            prospectWebsite: 'Prospect company website URL',
            prospectIndustry: 'Prospect industry',
            prospectLocation: 'Prospect location/country',
            buyerRole: 'Buyer persona: CEO | COO | CTO | IT Manager | HR Director | Finance Director | Marketing Director | Other',
            painOpportunity: 'Pain point or opportunity to address',
            offerToPosition: 'What we offer to this prospect',
            tone: 'Writing tone: Professional | Consultative | Direct | Educational | Confident | Approachable | Persuasive | Executive',
            language: 'Output language: en | pt-PT | fr (uses company language if not specified)',
            length: 'Content length: short | medium | long (default: medium)',
            callToAction: 'Optional: desired call to action',
        },
    },
    PRODUCT: {
        required: ['outputType', 'productOrFeature'],
        optional: ['targetPersona', 'problemSolved', 'keyBenefits', 'audienceType', 'detailLevel', 'tone', 'language'],
        descriptions: {
            outputType: 'Type of product content — choose the BEST one: PRD | BRD | FUNCTIONAL_SPEC | TECHNICAL_BRIEF | USER_STORIES | ACCEPTANCE_CRITERIA | FEATURE_BREAKDOWN | PRODUCT_POSITIONING | BRAND_POSITIONING | VIBE_CODING_SPEC | ROADMAP | EPIC_BREAKDOWN | API_DRAFT | DISCOVERY_ANALYSIS',
            productOrFeature: 'The product or feature being described',
            targetPersona: 'Target user persona',
            problemSolved: 'The problem this product/feature solves',
            keyBenefits: 'Main benefits or value points',
            audienceType: 'Who the document is for: business | technical | mixed (default: mixed)',
            detailLevel: 'How much detail: brief | medium | detailed (default: detailed)',
            tone: 'Writing tone: Professional | Simple | Technical | Educational | Friendly | Executive',
            language: 'Output language: en | pt-PT | fr (uses company language if not specified)',
        },
    },
    GENERAL_AI: {
        required: ['contentType', 'topic'],
        optional: ['audience', 'goal', 'tone', 'language', 'length'],
        descriptions: {
            contentType: 'Type of content — auto-selected from available skills',
            topic: 'The main topic or prompt for the content',
            audience: 'Target audience for the output',
            goal: 'What the content should achieve',
            tone: 'Writing tone: Professional | Simple | Consultative | Educational | Confident | Approachable',
            language: 'Output language: en | pt-PT | fr (uses company language if not specified)',
            length: 'Content length: short | medium | long (default: medium)',
        },
    },
    COMPANY_ADVISOR: {
        required: ['contentType', 'topic'],
        optional: ['audience', 'goal', 'tone', 'language', 'length'],
        descriptions: {
            contentType: 'Type of advisory content — choose the BEST one: INVESTMENT_MEMO | MARKET_ANALYSIS | COMPETITIVE_ANALYSIS | BUSINESS_PLAN | SWOT_ANALYSIS | STRATEGY_BRIEF | FINANCIAL_SUMMARY | RISK_ASSESSMENT',
            topic: 'The main topic or prompt for the content',
            audience: 'Target audience for the output',
            goal: 'What the content should achieve',
            tone: 'Writing tone: Professional | Analytical | Executive | Consultative',
            language: 'Output language: en | pt-PT | fr (uses company language if not specified)',
            length: 'Content length: short | medium | long (default: medium)',
        },
    },
    DESIGN_BRAND: {
        required: ['contentType', 'topic'],
        optional: ['audience', 'goal', 'tone', 'language'],
        descriptions: {
            contentType: 'Type of design output — choose the BEST one from available skills. Examples: WIREFRAME | UI_MOCKUP | BRAND_GUIDE | DESIGN_SYSTEM | LANDING_PAGE | COMPONENT_DESIGN',
            topic: 'What to design — the subject, page, or component',
            audience: 'Who will use/see this design (default: general users)',
            goal: 'Design goal (default: create a clear, usable design)',
            tone: 'Design style: Modern | Minimal | Bold | Corporate | Playful (default: Modern)',
            language: 'Output language: en | pt-PT | fr (uses company language if not specified)',
        },
    },
};

const ASSISTANT_LABELS = {
    MARKETING: '📣 AI Marketing Assistant',
    SALES: '💰 AI Sales Assistant',
    PRODUCT: '📦 AI Product Assistant',
    GENERAL_AI: '🤖 AI Assistant',
    COMPANY_ADVISOR: '🏢 Company Advisor',
};

/* ─── POST /api/ai-assistant/chat ────────────────────── */

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    try {
        const body = await request.json();
        const {
            assistantType,
            messages,
            contentType,         // may be empty string => auto-select
            availableContentTypes, // full list for auto-selection
            workspace,
            extractedParams = {},
            result,
            attachmentDocIds,    // workspace doc IDs
            attachmentFileNames, // uploaded file names (for context hint)
        } = body;

        const db = createAdminClient();

        const schema = FIELD_SCHEMAS[assistantType as keyof typeof FIELD_SCHEMAS]
            || FIELD_SCHEMAS.GENERAL_AI;  // Fallback for custom brain types

        // Resolve label — for custom brains, load from DB
        let assistantLabel = ASSISTANT_LABELS[assistantType as keyof typeof ASSISTANT_LABELS] || '';
        if (!assistantLabel) {
            const { data: brain } = await db.from('AIBrainProfile')
                .select('name')
                .eq('brainType', assistantType)
                .maybeSingle();
            assistantLabel = brain?.name ? `🧠 ${brain.name}` : `🤖 AI Assistant`;
        }

        const openai = new OpenAI({ apiKey });

        /* ── Fetch effective language: user preference > company language > 'en' ── */
        let companyLanguage = 'en';
        {
            const { data: dbUser } = await db.from('User').select('companyId, language').eq('email', auth.dbUser.email).maybeSingle();
            if (dbUser?.language && ['en', 'pt-PT', 'fr'].includes(dbUser.language)) {
                companyLanguage = dbUser.language;
            } else if (dbUser?.companyId) {
                const { data: company } = await db.from('Company').select('language').eq('id', dbUser.companyId).maybeSingle();
                if (company?.language) companyLanguage = company.language;
            }
        }

        /* ── Build workspace context ──────────────── */
        let workspaceContext = '';
        if (workspace?.id) {
            const { data: project } = await db.from('Project').select('name, description, contextText').eq('id', workspace.id).eq('companyId', auth.dbUser.companyId).maybeSingle();
            if (project) {
                workspaceContext = `\n=== PROJECT CONTEXT ===\nProject: ${project.name}${project.description ? `\nDescription: ${project.description}` : ''}${project.contextText ? `\nInstructions: ${project.contextText}` : ''}\n`;
            }
        } else {
            const { data: profile } = await db.from('CompanyProfile').select('companyName, productsServices, targetCustomers, valueProposition').eq('companyId', auth.dbUser.companyId).maybeSingle();
            if (profile) {
                workspaceContext = `\n=== COMPANY CONTEXT ===\n${profile.companyName ? `Company: ${profile.companyName}\n` : ''}${profile.productsServices ? `Services: ${profile.productsServices?.substring(0, 300)}\n` : ''}${profile.targetCustomers ? `Target Customers: ${profile.targetCustomers?.substring(0, 200)}\n` : ''}${profile.valueProposition ? `Value Proposition: ${profile.valueProposition?.substring(0, 200)}\n` : ''}`;
            }
        }

        /* ── Attachment context (workspace documents) ── */
        let attachmentContext = '';
        if (attachmentDocIds && attachmentDocIds.length > 0) {
            const { data: docs } = await db.from('Document').select('filename, extractedText').in('id', attachmentDocIds).eq('companyId', auth.dbUser.companyId);
            if (docs && docs.length > 0) {
                attachmentContext = '\n=== ATTACHED DOCUMENTS ===\n';
                for (const doc of docs) {
                    attachmentContext += `\n--- ${doc.filename} ---\n${(doc.extractedText || '').substring(0, 800)}\n`;
                }
            }
        }
        if (attachmentFileNames && attachmentFileNames.length > 0) {
            attachmentContext += `\nUser also attached these files for context: ${attachmentFileNames.join(', ')}\n`;
        }

        /* ── AUTO-SELECT: No contentType provided ────── */
        const noTypeSelected = !contentType || contentType.trim() === '';

        /* ── REFINEMENT MODE ─────────────────────────── */
        if (result) {
            const REFINEMENT_MAP: Record<string, string> = {
                shorten: 'shorten', shorter: 'shorten', 'more concise': 'shorten',
                expand: 'expand', longer: 'expand', 'more detail': 'expand',
                rewrite: 'rewrite', reword: 'rewrite',
                'change tone': 'change_tone', 'more persuasive': 'more_persuasive',
                'more formal': 'change_tone', regenerate: 'regenerate',
            };

            const lastUserMsg = (messages as { role: string; content: string }[]).filter(m => m.role === 'user').at(-1)?.content?.toLowerCase() || '';
            let detectedAction: string | null = null;
            for (const [keyword, action] of Object.entries(REFINEMENT_MAP)) {
                if (lastUserMsg.includes(keyword)) { detectedAction = action; break; }
            }

            if (detectedAction) {
                return NextResponse.json({
                    reply: `Got it — I'll ${lastUserMsg.trim()} ✨`,
                    extractedParams,
                    isReady: false,
                    refinementAction: detectedAction,
                });
            }

            const refSys = `You are the ${assistantLabel}. Map the user's request to a refinement action: shorten | expand | rewrite | change_tone | more_persuasive | regenerate. Return JSON: { "reply": "short ack", "refinementAction": "action_name" }`;
            const refRes = await openai.chat.completions.create({
                model: MODEL,
                messages: [{ role: 'system', content: refSys }, ...(messages as { role: string; content: string }[]).filter(m => m.content != null).slice(-3).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content || '' }))],
                response_format: { type: 'json_object' }, temperature: 0.3, max_completion_tokens: 200,
            });

            const refOut = JSON.parse(refRes.choices[0].message.content || '{}');
            return NextResponse.json({ reply: refOut.reply || 'Refining content...', extractedParams, isReady: false, refinementAction: refOut.refinementAction || 'rewrite' });
        }

        /* ── PARAMETER EXTRACTION MODE ───────────────── */
        const fieldDescriptions = Object.entries(schema.descriptions).map(([k, v]) => `  - ${k}: ${v}`).join('\n');
        const currentParamsStr = Object.keys(extractedParams).length > 0 ? `\nCurrent extracted parameters:\n${JSON.stringify(extractedParams, null, 2)}\n` : '\nNo parameters extracted yet.\n';
        const selectedContentType = contentType || extractedParams[schema.required[0]];

        // If no type selected, tell the AI to choose the best one from available types
        const autoSelectInstruction = noTypeSelected && availableContentTypes?.length > 0
            ? `\nIMPORTANT: The user has NOT selected a content type yet. Based on their request, AUTO-SELECT the best one from this list: [${availableContentTypes.join(', ')}]. Include it in extractedParams as "${schema.required[0]}".`
            : selectedContentType
            ? `\nIMPORTANT: The user has ALREADY selected the content/output type: "${selectedContentType}". Do NOT ask them which type they want — it is already decided. Accept it and move on to gathering the other required parameters. Include "${schema.required[0]}": "${selectedContentType}" in extractedParams.`
            : '';

        const systemPrompt = `You are the ${assistantLabel}, a conversational AI assistant.${workspaceContext}${attachmentContext}

Your job is to have a friendly conversation to gather the information needed to generate content. Ask ONE clarifying question at a time.

Required parameters: ${schema.required.join(', ')}
Optional parameters: ${schema.optional.join(', ')}

Field definitions:
${fieldDescriptions}${availableContentTypes?.length > 0 ? `\nValid ${schema.required[0]} values include (but are not limited to): ${availableContentTypes.join(', ')}` : ''}
${currentParamsStr}
${selectedContentType ? `Selected content type: ${selectedContentType}` : ''}
${autoSelectInstruction}

RULES:
- Be concise and friendly. No more than 2-3 sentences per reply.
- Extract parameters progressively — don't re-ask for already-collected params.
- CRITICAL: Only the REQUIRED parameters (${schema.required.join(', ')}) are needed to proceed. For ALL optional parameters, ALWAYS use sensible defaults — do NOT ask the user for optional params unless they explicitly volunteer the information.
- IMPORTANT: Only set isReady to true when you have ALL REQUIRED params filled. Once you have ALL required params, set isReady to true IMMEDIATELY — do NOT ask follow-up questions about optional params like audience, tone, goal, or language.
- If the user's first message already clearly states what they want (e.g. "create a wireframe for the homepage"), extract topic and auto-select contentType from available types, then set isReady to true right away.
- For optional fields, use these defaults unless the user specifies otherwise: language: "${companyLanguage}", length: "medium", tone: "Professional", audience: "general audience", goal: "inform and assist".
- Always return valid JSON with the schema below.

Return JSON: {
  "reply": "your conversational message",
  "extractedParams": { ...all params extracted so far },
  "isReady": boolean
}`;

        const aiMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...(messages as { role: string; content: string }[])
                .filter(m => m.content != null)
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content || '' })),
        ];

        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: aiMessages,
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_completion_tokens: 700,
        });

        const rawOutput = response.choices[0].message.content || '{}';
        let output: { reply: string; extractedParams: Record<string, unknown>; isReady: boolean };
        try { output = JSON.parse(rawOutput); }
        catch { output = { reply: 'Could you tell me more about what you need?', extractedParams, isReady: false }; }

        const mergedParams = { ...extractedParams, ...output.extractedParams };

        return NextResponse.json({
            reply: output.reply,
            extractedParams: mergedParams,
            isReady: output.isReady ?? false,
        });

    } catch (error) {
        console.error('[ai-assistant/chat] Error:', error);
        return NextResponse.json({ error: 'Chat failed', detail: String(error) }, { status: 500 });
    }
}
