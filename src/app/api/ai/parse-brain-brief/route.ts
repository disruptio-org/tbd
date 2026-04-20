// ─── POST /api/ai/parse-brain-brief — Parse voice/text description into BrainConfig ──

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { getDefaultBrainConfig } from '@/lib/ai-brains/defaults';
import type { BrainType } from '@/lib/ai-brains/schema';

const MODEL = 'gpt-5.4-mini';

const BRAIN_CONFIG_SCHEMA_DESC = `
You must return a JSON object matching this exact BrainConfig structure. Every field is REQUIRED.

{
  "identity": {
    "tonePreset": one of ["professional_consultative","friendly_approachable","formal_corporate","warm_supportive","direct_efficient","creative_expressive","authoritative_expert"],
    "formality": 0-10 (0=casual, 10=very formal),
    "warmth": 0-10 (0=neutral/cold, 10=very warm/empathetic),
    "assertiveness": 0-10 (0=gentle/tentative, 10=very assertive/confident),
    "creativity": 0-10 (0=conservative/predictable, 10=very creative/original),
    "humor": 0-10 (0=no humor, 10=playful/witty),
    "brandStrictness": 0-10 (0=flexible, 10=very strict brand adherence),
    "communicationStyle": one of ["structured","conversational","concise","consultative","executive","educational"],
    "languagePreference": "auto"
  },
  "reasoning": {
    "depth": 0-10 (0=surface/quick, 10=very deep analysis),
    "speedVsThoroughness": 0-10 (0=quick, 10=thorough),
    "proactiveness": 0-10 (0=reactive/waits for questions, 10=very proactive/suggests things),
    "challengeLevel": 0-10 (0=always agrees, 10=challenges assumptions),
    "analyticalStyle": 0-10 (0=intuitive/gut-feeling, 10=analytical/data-driven),
    "recommendationStrength": 0-10 (0=soft suggestions, 10=strong decisive recommendations),
    "askWhenUncertain": true/false,
    "provideOptions": true/false (offer multiple options),
    "explainReasoning": true/false (explain why behind answers),
    "useStructuredResponses": true/false (use bullet points / headers),
    "bestEffortBias": one of ["best_effort","clarification_first","balanced"]
  },
  "knowledge": {
    "preferInternalSources": true/false,
    "preferCuratedSources": true/false,
    "useCompanyProfile": true/false,
    "recencySensitivity": 0-10 (0=age-neutral, 10=strongly favor recent docs),
    "sourceStrictness": 0-10 (0=flexible, 10=very strict source adherence),
    "citationStrictness": 0-10 (0=rarely cite, 10=always cite sources),
    "allowPartialAnswers": true/false,
    "requireGroundingForSensitiveTopics": true/false,
    "answerOnlyWhenGrounded": true/false,
    "useExternalSearchWhenWeak": true/false,
    "answerConfidenceThreshold": 0.0-1.0 (default ~0.55),
    "escalationConfidenceThreshold": 0.0-1.0 (default ~0.35)
  },
  "taskBehavior": {
    "detailLevel": 0-10 (0=high-level, 10=very detailed),
    "actionOrientation": 0-10 (0=informational, 10=action-focused/practical),
    "persuasion": 0-10 (0=neutral/objective, 10=persuasive),
    "educationalStyle": 0-10 (0=direct answers only, 10=full educational explanation),
    "verbosity": one of ["brief","medium","detailed"],
    "summaryStyle": one of ["structured","narrative","bullet_points"]
  },
  "guardrails": {
    "avoidInventingData": true/false,
    "flagUncertainty": true/false,
    "avoidLegalAdvice": true/false,
    "avoidFinancialAdvice": true/false,
    "avoidHrSensitiveAssumptions": true/false,
    "avoidPricingCommitments": true/false,
    "avoidContractualCommitments": true/false,
    "sensitiveTopics": string[] (e.g. ["hr","finance","policy","pricing","compliance"]),
    "requireHighConfidenceForPolicyAnswers": true/false,
    "escalationInstruction": string (what to do when uncertain on sensitive topics),
    "blockedBehaviors": string[],
    "restrictedClaims": string[]
  },
  "delegation": {
    "ownedTopics": string[],
    "deferTopics": string[],
    "allowDelegation": true/false
  }
}`;

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await request.json();
        const { transcript, brainType } = body as { transcript: string; brainType: string };

        if (!transcript?.trim()) {
            return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

        // Get sensible defaults for the brain type as fallback reference
        const validBrainType = (brainType || 'COMPANY') as BrainType;
        const defaults = getDefaultBrainConfig(validBrainType);

        // Load company context for richer understanding
        let companyContext = '';
        const { data: company } = await db.from('Company').select('name, productsServices, targetCustomers').eq('id', dbUser.companyId).maybeSingle();
        if (company?.name) {
            companyContext = `\nCompany: ${company.name}${company.productsServices ? `. Products/Services: ${company.productsServices}` : ''}${company.targetCustomers ? `. Target Customers: ${company.targetCustomers}` : ''}`;
        }

        const systemPrompt = `You are an AI Brain configurator. The user will describe how they want their AI assistant to behave — its personality, tone, communication style, etc. Your job is to translate that description into a full BrainConfig JSON object.

BRAIN CONFIG SCHEMA:
${BRAIN_CONFIG_SCHEMA_DESC}

BRAIN TYPE: ${validBrainType}${companyContext}

DEFAULTS (use these as starting point; only change values the user's description implies):
${JSON.stringify(defaults, null, 2)}

RULES:
1. Return ONLY valid JSON — no prose, no markdown, no code fences
2. ALL fields are required — for fields the user didn't mention, keep the default values
3. Interpret the user's intent intelligently — e.g. "friendly" → high warmth, lower formality, warm_supportive tone
4. Be smart about correlations — e.g. "professional" implies higher formality + structured style
5. Keep "languagePreference" as "auto" unless the user specifies a language
6. Make sure numeric values are integers 0-10 for sliders, and 0.0-1.0 for thresholds
7. Keep guardrails sensible — only relax safety settings if the user explicitly asks for it`;

        const userPrompt = `Here is how the user described the AI personality they want:

"""
${transcript}
"""

Return the complete BrainConfig JSON:`;

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 2048,
            temperature: 0.3, // Low temperature for structured output
        });

        const rawResponse = completion.choices[0]?.message?.content?.trim() || '{}';

        // Parse JSON — strip code fences if the model added them
        let config;
        try {
            const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            config = JSON.parse(cleaned);
        } catch {
            console.error('[parse-brain-brief] Failed to parse JSON:', rawResponse);
            return NextResponse.json({ error: 'Failed to parse AI response', raw: rawResponse }, { status: 500 });
        }

        return NextResponse.json({ config });
    } catch (error) {
        console.error('[parse-brain-brief] error:', error);
        return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
    }
}
