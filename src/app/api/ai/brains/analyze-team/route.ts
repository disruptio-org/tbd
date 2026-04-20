// ═══════════════════════════════════════════════════════
// POST /api/ai/brains/analyze-team
// Analyzes an existing AI team and suggests improvements:
// missing roles, config upgrades, collaboration gaps
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const MODEL = 'gpt-5.4-mini';

export interface TeamSuggestion {
    type: 'add_role' | 'upgrade_config' | 'collaboration_gap' | 'general';
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    actionLabel: string;
    brainType?: string;   // for add_role suggestions
    targetBrain?: string; // for upgrade suggestions — name of existing brain
}

export interface TeamAnalysisResult {
    overallScore: number;         // 1–10
    overallAssessment: string;
    strengths: string[];
    suggestions: TeamSuggestion[];
}

export async function POST() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

        // ── Load company context ──
        const [profileResult, companyResult, brainsResult] = await Promise.all([
            db.from('CompanyProfile').select('companyName, description, industry, productsServices, mainOfferings, valueProposition, targetCustomers, strategicGoals, brandTone, departments').eq('companyId', dbUser.companyId).maybeSingle(),
            db.from('Company').select('name, productsServices, targetCustomers').eq('id', dbUser.companyId).maybeSingle(),
            db.from('AIBrainProfile').select('id, brainType, name, description, status, configJson, advancedInstructions').eq('companyId', dbUser.companyId),
        ]);

        const profile = profileResult.data;
        const company = companyResult.data;
        const brains = brainsResult.data || [];

        if (brains.length === 0) {
            return NextResponse.json({ error: 'No team members to analyze' }, { status: 400 });
        }

        // Build company context
        const contextParts: string[] = [];
        if (profile) {
            if (profile.companyName) contextParts.push(`Company: ${profile.companyName}`);
            if (profile.description) contextParts.push(`Description: ${profile.description}`);
            if (profile.industry) contextParts.push(`Industry: ${profile.industry}`);
            if (profile.productsServices) contextParts.push(`Products/Services: ${profile.productsServices}`);
            if (profile.mainOfferings) contextParts.push(`Main Offerings: ${profile.mainOfferings}`);
            if (profile.valueProposition) contextParts.push(`Value Proposition: ${profile.valueProposition}`);
            if (profile.targetCustomers) contextParts.push(`Target Customers: ${profile.targetCustomers}`);
            if (profile.strategicGoals) contextParts.push(`Strategic Goals: ${profile.strategicGoals}`);
            if (profile.brandTone) contextParts.push(`Brand Tone: ${profile.brandTone}`);
            if (profile.departments) contextParts.push(`Departments: ${profile.departments}`);
        } else if (company) {
            if (company.name) contextParts.push(`Company: ${company.name}`);
            if (company.productsServices) contextParts.push(`Products/Services: ${company.productsServices}`);
            if (company.targetCustomers) contextParts.push(`Target Customers: ${company.targetCustomers}`);
        }

        // Build team summary
        const teamSummary = brains.map(b => {
            const config = b.configJson;
            const identity = config?.identity;
            const advInstr = b.advancedInstructions;
            return [
                `- ${b.name} (type: ${b.brainType}, status: ${b.status})`,
                b.description ? `  Description: ${b.description}` : '',
                identity?.tonePreset ? `  Tone: ${identity.tonePreset}` : '',
                identity?.communicationStyle ? `  Communication: ${identity.communicationStyle}` : '',
                identity?.personalityTraits?.length ? `  Personality: ${identity.personalityTraits.join(', ')}` : '',
                advInstr?.roleSpecificNotes ? `  Role notes: ${advInstr.roleSpecificNotes}` : '',
            ].filter(Boolean).join('\n');
        }).join('\n\n');

        const existingTypes = brains.map(b => b.brainType).join(', ');

        // ── LLM Analysis ──
        const systemPrompt = `You are an expert AI team strategist. Analyze the company's existing AI team composition against their company profile and identify gaps, improvements, and strengths.

COMPANY CONTEXT:
${contextParts.join('\n') || 'No detailed company profile available.'}

EXISTING AI TEAM (${brains.length} members):
${teamSummary}

Existing brain types: ${existingTypes}

AVAILABLE BRAIN TYPES (that could be added):
- SALES: Revenue, pipeline, deal management
- MARKETING: Content, campaigns, brand
- COMPANY_ADVISOR: Strategic consulting, analysis
- ONBOARDING: New user/employee onboarding
- LEAD_DISCOVERY: Prospect identification, market research
- PRODUCT_ASSISTANT: Product support, feature guidance

ANALYSIS RULES:
1. Score the team 1-10 based on coverage, differentiation, and alignment with the company's needs
2. Identify 2-3 specific strengths
3. Suggest 3-6 actionable improvements, each categorized as:
   - "add_role": A missing role type that would benefit this company
   - "upgrade_config": An existing brain that could be improved (e.g. personality too generic, tone mismatch)
   - "collaboration_gap": Missing collaboration between existing members
   - "general": General team organization improvement
4. Each suggestion needs a severity (high/medium/low) and a clear, specific action
5. Be specific to THIS company — no generic advice
6. Do NOT suggest adding roles that already exist (existing types: ${existingTypes})

Respond in JSON matching this exact schema:
{
  "overallScore": number,
  "overallAssessment": "string — 2-3 sentence assessment",
  "strengths": ["string", "string"],
  "suggestions": [
    {
      "type": "add_role" | "upgrade_config" | "collaboration_gap" | "general",
      "severity": "high" | "medium" | "low",
      "title": "short title",
      "description": "specific, actionable description",
      "actionLabel": "short CTA label (e.g. 'Add Sales Brain', 'Adjust Tone')",
      "brainType": "only for add_role — one of the available types",
      "targetBrain": "only for upgrade_config — name of the existing brain to modify"
    }
  ]
}`;

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: 'Analyze this AI team and provide actionable improvement suggestions.' },
            ],
            max_completion_tokens: 2048,
            temperature: 0.4,
            response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content?.trim() || '{}';
        let analysis: TeamAnalysisResult;

        try {
            analysis = JSON.parse(raw);
        } catch {
            console.error('[analyze-team] Failed to parse LLM response:', raw);
            return NextResponse.json({ error: 'Failed to parse analysis' }, { status: 500 });
        }

        // Validate and sanitize
        if (!analysis.overallScore || !analysis.suggestions) {
            return NextResponse.json({ error: 'Incomplete analysis' }, { status: 500 });
        }

        // Ensure no suggestions reference existing types for add_role
        const existingTypesSet = new Set(brains.map(b => b.brainType));
        analysis.suggestions = analysis.suggestions.filter(s => {
            if (s.type === 'add_role' && s.brainType && existingTypesSet.has(s.brainType)) {
                return false; // skip — already exists
            }
            return true;
        });

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('[analyze-team] error:', error);
        return NextResponse.json({ error: 'Team analysis failed' }, { status: 500 });
    }
}
