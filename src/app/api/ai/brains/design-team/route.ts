// ═══════════════════════════════════════════════════════
// POST /api/ai/brains/design-team
// AI Team Designer — generates a company-aligned AI team
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { validateBrainConfig } from '@/lib/ai-brains/schema';
import { TEAM_SIZE_RANGES } from '@/lib/ai-brains/team-designer';
import type { TeamDesignRequest, TeamDesignResult, TeamMemberProposal, TeamSize } from '@/lib/ai-brains/team-designer';

const MODEL = 'gpt-5.4-mini';

// ─── Brain Config Schema (for LLM output) ─────────────
const BRAIN_CONFIG_SCHEMA = `{
  "identity": {
    "tonePreset": one of ["professional_consultative","friendly_approachable","formal_corporate","warm_supportive","direct_efficient","creative_expressive","authoritative_expert"],
    "formality": 0-10, "warmth": 0-10, "assertiveness": 0-10, "creativity": 0-10, "humor": 0-10, "brandStrictness": 0-10,
    "communicationStyle": one of ["structured","conversational","concise","consultative","executive","educational"],
    "languagePreference": "auto",
    "personalityTraits": string[] (max 5, from: Creative, Formal, Warm, Direct, Analytical, Playful, Conservative, Bold, Educational, Empathetic)
  },
  "reasoning": {
    "depth": 0-10, "speedVsThoroughness": 0-10, "proactiveness": 0-10, "challengeLevel": 0-10,
    "analyticalStyle": 0-10, "recommendationStrength": 0-10,
    "askWhenUncertain": boolean, "provideOptions": boolean, "explainReasoning": boolean,
    "useStructuredResponses": boolean, "bestEffortBias": one of ["best_effort","clarification_first","balanced"]
  },
  "knowledge": {
    "preferInternalSources": boolean, "preferCuratedSources": boolean, "useCompanyProfile": boolean,
    "recencySensitivity": 0-10, "sourceStrictness": 0-10, "citationStrictness": 0-10,
    "allowPartialAnswers": boolean, "requireGroundingForSensitiveTopics": boolean,
    "answerOnlyWhenGrounded": boolean, "useExternalSearchWhenWeak": boolean,
    "answerConfidenceThreshold": 0.0-1.0, "escalationConfidenceThreshold": 0.0-1.0
  },
  "taskBehavior": {
    "detailLevel": 0-10, "actionOrientation": 0-10, "persuasion": 0-10, "educationalStyle": 0-10,
    "verbosity": one of ["brief","medium","detailed"], "summaryStyle": one of ["structured","narrative","bullet_points"]
  },
  "guardrails": {
    "avoidInventingData": boolean, "flagUncertainty": boolean, "avoidLegalAdvice": boolean,
    "avoidFinancialAdvice": boolean, "avoidHrSensitiveAssumptions": boolean,
    "avoidPricingCommitments": boolean, "avoidContractualCommitments": boolean,
    "sensitiveTopics": string[], "requireHighConfidenceForPolicyAnswers": boolean,
    "escalationInstruction": string, "blockedBehaviors": string[], "restrictedClaims": string[]
  },
  "delegation": {
    "ownedTopics": string[], "deferTopics": string[], "allowDelegation": boolean
  }
}`;

// ─── Built-in brain types (prefer these) ──────────────
const BUILT_IN_TYPES = [
    'COMPANY_ADVISOR', 'SALES', 'MARKETING', 'ONBOARDING', 'LEAD_DISCOVERY', 'PRODUCT_ASSISTANT',
];

// ── P2.4: Module → Role enrichment map ──
const MODULE_ROLE_HINTS: Record<string, { relevantRoles: string[]; capabilities: string }> = {
    crm: { relevantRoles: ['SALES', 'LEAD_DISCOVERY'], capabilities: 'CRM pipeline management, deal tracking, contact management, activity logging' },
    tasks: { relevantRoles: ['PRODUCT_ASSISTANT', 'COMPANY_ADVISOR'], capabilities: 'Task creation, assignment, tracking, sprint planning, deadline management' },
    projects_workspaces: { relevantRoles: ['PRODUCT_ASSISTANT', 'COMPANY_ADVISOR'], capabilities: 'Project workspace management, milestone tracking, team collaboration' },
    leads: { relevantRoles: ['LEAD_DISCOVERY', 'SALES'], capabilities: 'Lead generation, prospect scoring, market research, ICP matching' },
    marketing: { relevantRoles: ['MARKETING'], capabilities: 'Content generation, campaign management, email marketing, social media' },
    sales: { relevantRoles: ['SALES'], capabilities: 'Sales content generation, outreach sequences, proposal drafting, objection handling' },
    documents: { relevantRoles: ['COMPANY_ADVISOR', 'PRODUCT_ASSISTANT'], capabilities: 'Document management, knowledge base, file organization, OCR processing' },
    classifications: { relevantRoles: ['COMPANY_ADVISOR'], capabilities: 'Data extraction, document classification, structured data processing' },
    knowledge_gaps: { relevantRoles: ['COMPANY_ADVISOR'], capabilities: 'Knowledge gap detection, missing documentation identification, coverage analysis' },
    onboarding_assistant: { relevantRoles: ['ONBOARDING'], capabilities: 'New user onboarding, guided setup, feature discovery, training flows' },
    integrations: { relevantRoles: ['COMPANY_ADVISOR'], capabilities: 'Third-party integrations, data sync, external tool connectivity' },
};

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId, role').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json() as TeamDesignRequest;
        const { goal, teamSize, userIntent } = body;

        if (!goal || !teamSize) {
            return NextResponse.json({ error: 'goal and teamSize are required' }, { status: 400 });
        }

        const sizeRange = TEAM_SIZE_RANGES[teamSize as TeamSize];
        if (!sizeRange) {
            return NextResponse.json({ error: 'Invalid teamSize' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

        // ── 1. Load company context ──
        const [profileResult, companyResult, brainsResult, featuresResult, docsResult, extDocsResult] = await Promise.all([
            db.from('CompanyProfile').select('*').eq('companyId', dbUser.companyId).maybeSingle(),
            db.from('Company').select('name, plan, productsServices, targetCustomers, webContext').eq('id', dbUser.companyId).maybeSingle(),
            db.from('AIBrainProfile').select('brainType, name').eq('companyId', dbUser.companyId),
            db.from('CompanyFeature').select('featureKey').eq('companyId', dbUser.companyId).eq('isEnabled', true),
            // P2.5: Knowledge base stats
            db.from('Document').select('id, knowledgeCategory, useAsKnowledgeSource').eq('companyId', dbUser.companyId).eq('useAsKnowledgeSource', true),
            db.from('ExternalDocument').select('id, knowledgeCategory, useAsKnowledgeSource').eq('companyId', dbUser.companyId).eq('useAsKnowledgeSource', true),
        ]);

        const profile = profileResult.data;
        const company = companyResult.data;
        const existingBrains = (brainsResult.data || []).filter(b => b.brainType !== 'COMPANY');
        const enabledFeatures = (featuresResult.data || []).map((f: { featureKey: string }) => f.featureKey);

        // ── 2. Build company context string ──
        const contextParts: string[] = [];
        if (profile) {
            if (profile.companyName) contextParts.push(`Company Name: ${profile.companyName}`);
            if (profile.description) contextParts.push(`Description: ${profile.description}`);
            if (profile.industry) contextParts.push(`Industry: ${profile.industry}`);
            if (profile.productsServices) contextParts.push(`Products/Services: ${profile.productsServices}`);
            if (profile.mainOfferings) contextParts.push(`Main Offerings: ${profile.mainOfferings}`);
            if (profile.valueProposition) contextParts.push(`Value Proposition: ${profile.valueProposition}`);
            if (profile.targetCustomers) contextParts.push(`Target Customers: ${profile.targetCustomers}`);
            if (profile.targetIndustries) contextParts.push(`Target Industries: ${profile.targetIndustries}`);
            if (profile.markets) contextParts.push(`Markets: ${profile.markets}`);
            if (profile.departments) contextParts.push(`Departments: ${profile.departments}`);
            if (profile.strategicGoals) contextParts.push(`Strategic Goals: ${profile.strategicGoals}`);
            if (profile.brandTone) contextParts.push(`Brand Tone: ${profile.brandTone}`);
            if (profile.competitors) contextParts.push(`Competitors: ${profile.competitors}`);
            if (profile.keyProcesses) contextParts.push(`Key Processes: ${profile.keyProcesses}`);
        } else if (company) {
            if (company.name) contextParts.push(`Company Name: ${company.name}`);
            if (company.productsServices) contextParts.push(`Products/Services: ${company.productsServices}`);
            if (company.targetCustomers) contextParts.push(`Target Customers: ${company.targetCustomers}`);
        }

        if (enabledFeatures.length > 0) {
            contextParts.push(`Enabled Platform Modules: ${enabledFeatures.join(', ')}`);
        }

        const companyContext = contextParts.join('\n');

        // ── P2.4: Module-aware enrichment ──
        const moduleInstructions: string[] = [];
        for (const featureKey of enabledFeatures) {
            const hint = MODULE_ROLE_HINTS[featureKey];
            if (hint) {
                moduleInstructions.push(`- Module "${featureKey}" is enabled (capabilities: ${hint.capabilities}). Consider enhancing roles: ${hint.relevantRoles.join(', ')}.`);
            }
        }
        const moduleContext = moduleInstructions.length > 0
            ? `\nENABLED MODULES & CAPABILITIES:\n${moduleInstructions.join('\n')}\nIMPORTANT: Roles that interact with enabled modules should include module-specific responsibilities and instructions.`
            : '';

        // ── P2.5: Knowledge base context ──
        const knowledgeDocs = [...(docsResult.data || []), ...(extDocsResult.data || [])];
        const knowledgeCategories = [...new Set(knowledgeDocs.map(d => d.knowledgeCategory).filter(Boolean))];
        const knowledgeContext = knowledgeDocs.length > 0
            ? `\nKNOWLEDGE BASE:\n- ${knowledgeDocs.length} knowledge sources available${knowledgeCategories.length > 0 ? `\n- Categories: ${knowledgeCategories.join(', ')}` : ''}\nIMPORTANT: Roles that use the knowledge base should have knowledge.preferInternalSources=true and knowledge.useCompanyProfile=true. Set higher sourceStrictness for roles that rely heavily on company documentation.`
            : '';

        // ── 3. Existing team context ──
        const existingContext = existingBrains.length > 0
            ? `\nALREADY ON THE TEAM (do NOT duplicate these, but design new members to complement them):\n${existingBrains.map(b => `- ${b.name} (type: ${b.brainType})`).join('\n')}`
            : '';

        // ── 4. Build LLM prompt ──
        const systemPrompt = `You are an AI Organization Designer. Your job is to design a complete, coherent AI operating team for a company.

COMPANY CONTEXT:
${companyContext || 'No company profile provided — design a general-purpose team.'}
${existingContext}
${moduleContext}
${knowledgeContext}

DESIGN CONSTRAINTS:
- Team goal orientation: ${goal.toUpperCase()}
- Team size: ${sizeRange.min} to ${sizeRange.max} members
${userIntent ? `- User priority: ${userIntent}` : ''}

BUILT-IN BRAIN TYPES (prefer these when they match):
${BUILT_IN_TYPES.map(t => `- ${t}`).join('\n')}
When no built-in type fits, create a custom type prefixed with CUSTOM_ (e.g. CUSTOM_CUSTOMER_SUCCESS, CUSTOM_CONTENT_STRATEGIST).

BRAIN CONFIG SCHEMA (each member needs a complete configJson matching this):
${BRAIN_CONFIG_SCHEMA}

OUTPUT FORMAT — Return ONLY valid JSON matching this exact structure:
{
  "summary": "2-3 sentence description of the team's operating model and strategic alignment",
  "collaboration": "3-5 sentence description of how members work together, who leads what, handoff rules",
  "members": [
    {
      "brainType": "SALES or CUSTOM_ROLE_NAME",
      "name": "Human-readable role name",
      "description": "1 sentence role description",
      "mission": "1 sentence core mission",
      "responsibilities": ["resp 1", "resp 2", "resp 3", "resp 4", "resp 5"],
      "personalityTraits": ["Trait1", "Trait2", "Trait3"],
      "configJson": { /* full BrainConfig */ },
      "advancedInstructions": {
        "additionalSystemInstructions": "role-specific system instructions",
        "forbiddenPhrasing": "",
        "preferredTerminology": "role-specific terminology preferences",
        "outputExamples": "",
        "roleSpecificNotes": "how this member collaborates with others"
      },
      "collaborationRules": ["Works with X on...", "Receives input from Y when...", "Hands off to Z for..."]
    }
  ]
}

CRITICAL RULES:
1. Each member MUST have a clearly different role, mission, and personality — NO overlap.
2. Responsibilities must be concrete and actionable, not generic ("Manages things").
3. configJson values MUST reflect the member's specific role (a Sales brain has high persuasion, a Product brain has high analyticalStyle, etc.).
4. personalityTraits MUST be from: Creative, Formal, Warm, Direct, Analytical, Playful, Conservative, Bold, Educational, Empathetic (max 5 per member).
5. Every member must connect to at least one other member via collaborationRules — no isolated roles.
6. The team must reflect the COMPANY CONTEXT — industry, products, goals must shape role selection.
7. ALL numeric values in configJson must be integers 0-10, thresholds must be 0.0-1.0.
8. Return ONLY valid JSON — no markdown, no code fences, no commentary.`;

        const userPrompt = `Design a ${teamSize} AI team (${sizeRange.min}-${sizeRange.max} members) oriented towards ${goal} for this company. Return the full JSON now.`;

        // ── 5. Call LLM ──
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 8192,
            temperature: 0.4,
        });

        const rawResponse = completion.choices[0]?.message?.content?.trim() || '{}';

        // ── 6. Parse and validate ──
        let result: TeamDesignResult;
        try {
            const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            result = JSON.parse(cleaned);
        } catch {
            console.error('[design-team] Failed to parse LLM JSON:', rawResponse.substring(0, 500));
            return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
        }

        // Validate structure
        if (!result.members || !Array.isArray(result.members) || result.members.length === 0) {
            return NextResponse.json({ error: 'AI returned no team members' }, { status: 500 });
        }

        // Validate each member's config
        const validatedMembers: TeamMemberProposal[] = [];
        for (const member of result.members) {
            if (!member.brainType || !member.name || !member.configJson) {
                continue; // skip invalid members
            }

            const validation = validateBrainConfig(member.configJson);
            if (!validation.valid) {
                console.warn(`[design-team] Invalid config for ${member.name}:`, validation.errors);
                // Still include it — the UI can show a warning
            }

            // Ensure required fields exist
            validatedMembers.push({
                brainType: member.brainType,
                name: member.name,
                description: member.description || '',
                mission: member.mission || '',
                responsibilities: Array.isArray(member.responsibilities) ? member.responsibilities : [],
                personalityTraits: Array.isArray(member.personalityTraits) ? member.personalityTraits.slice(0, 5) : [],
                configJson: member.configJson,
                advancedInstructions: member.advancedInstructions || {
                    additionalSystemInstructions: '',
                    forbiddenPhrasing: '',
                    preferredTerminology: '',
                    outputExamples: '',
                    roleSpecificNotes: '',
                },
                collaborationRules: Array.isArray(member.collaborationRules) ? member.collaborationRules : [],
            });
        }

        if (validatedMembers.length === 0) {
            return NextResponse.json({ error: 'No valid team members generated' }, { status: 500 });
        }

        return NextResponse.json({
            team: {
                summary: result.summary || '',
                collaboration: result.collaboration || '',
                members: validatedMembers,
            },
        });
    } catch (error) {
        console.error('[design-team] error:', error);
        return NextResponse.json({ error: 'Team design failed' }, { status: 500 });
    }
}
