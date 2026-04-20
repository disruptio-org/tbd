// ═══════════════════════════════════════════════════════
// POST /api/ai/brains/suggest
// Quick AI suggestion — uses Company DNA brain context
// to help users fill in custom goals and priorities
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const MODEL = 'gpt-5.4-mini';

interface SuggestBody {
    type: 'custom_goal' | 'priorities' | 'operating_model' | 'collaboration_model';
    currentValue?: string;
    teamMembers?: string[]; // names of team members for model suggestions
}

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await request.json() as SuggestBody;
        const { type, currentValue, teamMembers } = body;

        if (!type || !['custom_goal', 'priorities', 'operating_model', 'collaboration_model'].includes(type)) {
            return NextResponse.json({ error: 'Invalid suggestion type' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

        // ── Load company context ──
        const [profileResult, companyResult, brainsResult] = await Promise.all([
            db.from('CompanyProfile').select('companyName, description, industry, productsServices, mainOfferings, valueProposition, targetCustomers, strategicGoals, brandTone, departments').eq('companyId', dbUser.companyId).maybeSingle(),
            db.from('Company').select('name, productsServices, targetCustomers').eq('id', dbUser.companyId).maybeSingle(),
            db.from('AIBrainProfile').select('brainType, name, configJson').eq('companyId', dbUser.companyId).eq('brainType', 'COMPANY').maybeSingle(),
        ]);

        const profile = profileResult.data;
        const company = companyResult.data;
        const companyBrain = brainsResult.data;

        // Build context
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

        // Company DNA personality
        const dnaConfig = companyBrain?.configJson;
        if (dnaConfig?.identity) {
            const id = dnaConfig.identity;
            if (id.tonePreset) contextParts.push(`Brand Tone Preset: ${id.tonePreset}`);
            if (id.communicationStyle) contextParts.push(`Communication Style: ${id.communicationStyle}`);
            if (id.personalityTraits?.length) contextParts.push(`Company Personality: ${id.personalityTraits.join(', ')}`);
        }

        const companyContext = contextParts.join('\n');

        // ── Build prompt based on type ──
        let systemPrompt: string;
        let userPrompt: string;

        if (type === 'custom_goal') {
            systemPrompt = `You are the Company DNA brain — you deeply understand this company's identity, goals, and market position.

COMPANY CONTEXT:
${companyContext || 'No company profile available.'}

Based on this company's profile, suggest a specific, actionable custom goal for their AI team. The goal should reflect what the company actually needs based on their industry, products, and strategic direction.

RULES:
- Return ONLY the goal description as a single sentence (30-60 words)
- Be specific to THIS company — no generic goals
- Focus on an area not covered by standard goals (Growth, Product, Operations, Brand)
- Consider their industry, challenges, and strategic goals`;

            userPrompt = currentValue
                ? `The user started describing their goal as: "${currentValue}". Expand and refine this into a clear, specific goal for their AI team based on the company context.`
                : `Suggest the most impactful custom AI team goal for this company. What area would benefit most from AI assistance?`;

        } else if (type === 'priorities') {
            systemPrompt = `You are the Company DNA brain — you deeply understand this company's identity, goals, and market position.

COMPANY CONTEXT:
${companyContext || 'No company profile available.'}

Based on this company's profile, suggest specific team priorities that should guide their AI team design. Priorities should reflect real operational needs.

RULES:
- Return ONLY the priority description as a single sentence (30-60 words)
- Be specific to THIS company — no generic advice
- Focus on practical, operational priorities
- Reference their actual products, market, or challenges`;

            userPrompt = currentValue
                ? `The user started describing their priorities as: "${currentValue}". Expand and refine this into specific, actionable priorities based on the company context.`
                : `What should be the top operational priority for this company's AI team? What specific area needs the most attention?`;

        } else if (type === 'operating_model') {
            const membersStr = teamMembers?.length ? `\nTeam Members: ${teamMembers.join(', ')}` : '';
            systemPrompt = `You are the Company DNA brain. Write a concise Team Operating Model description.

COMPANY CONTEXT:
${companyContext || 'No company profile available.'}${membersStr}

RULES:
- Return 2-4 sentences describing HOW this team operates together
- Explain the team's approach, methodology, and value delivery
- Be specific to this company's industry and goals
- Do NOT list individual members — describe the system`;

            userPrompt = currentValue
                ? `The current operating model is: "${currentValue}". Refine and improve this description based on the company context.`
                : `Write a concise operating model for this AI team.`;

        } else {
            // collaboration_model
            const membersStr = teamMembers?.length ? `\nTeam Members: ${teamMembers.join(', ')}` : '';
            systemPrompt = `You are the Company DNA brain. Write a Collaboration Model description.

COMPANY CONTEXT:
${companyContext || 'No company profile available.'}${membersStr}

RULES:
- Return 2-4 sentences describing HOW team members collaborate
- Define handoff protocols, escalation paths, and feedback loops
- Reference specific team members by name where relevant
- Focus on workflows, not individual responsibilities`;

            userPrompt = currentValue
                ? `The current collaboration model is: "${currentValue}". Refine and improve it to better describe how team members work together.`
                : `Write a collaboration model describing how these AI team members should work together.`;
        }

        // ── Call LLM ──
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 200,
            temperature: 0.6,
        });

        const suggestion = completion.choices[0]?.message?.content?.trim() || '';

        return NextResponse.json({ suggestion });
    } catch (error) {
        console.error('[suggest] error:', error);
        return NextResponse.json({ error: 'Suggestion failed' }, { status: 500 });
    }
}
