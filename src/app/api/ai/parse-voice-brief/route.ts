// ─── POST /api/ai/parse-voice-brief — Parse voice rant into form fields ──

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { resolveEffectiveBrainConfig } from '@/lib/ai-brains/resolve-effective-brain';
import { buildBrainSystemPrompt, getBrainTemperature } from '@/lib/ai-brains/build-brain-prompt';
import { getAiLanguageName } from '@/i18n';
import type { BrainConfig } from '@/lib/ai-brains/schema';

const MODEL = 'gpt-5.4-mini';

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await request.json();
        const { transcript, assistantType, fieldSchema, documentIds, projectId, teamMembers } = body;

        if (!transcript || !assistantType || !fieldSchema) {
            return NextResponse.json({ error: 'transcript, assistantType, and fieldSchema are required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

        // Get company language
        const { data: companyData } = await db.from('Company').select('language').eq('id', dbUser.companyId).maybeSingle();
        const companyLang = (companyData?.language as 'en' | 'pt-PT' | 'fr') || 'en';
        const aiLanguageName = getAiLanguageName(companyLang);

        // Load context (prioritize project context over company profile)
        let activeContext = '';

        if (projectId) {
            const { data: project } = await db.from('Project').select('name, description, contextText').eq('id', projectId).eq('companyId', dbUser.companyId).maybeSingle();
            if (project) {
                const parts: string[] = [];
                if (project.name) parts.push(`Project: ${project.name}`);
                if (project.description) parts.push(`Description: ${project.description}`);
                if (project.contextText) parts.push(`Instructions: ${project.contextText}`);
                if (parts.length > 0) activeContext = `\n\nPROJECT CONTEXT:\n${parts.join('\n')}`;
            }
        }

        if (!activeContext) {
            const { data: companyProfile } = await db.from('Company').select('name, productsServices, targetCustomers, markets, valueProposition, targetIndustries').eq('id', dbUser.companyId).maybeSingle();
            if (companyProfile) {
                const parts: string[] = [];
                if (companyProfile.name) parts.push(`Company: ${companyProfile.name}`);
                if (companyProfile.productsServices) parts.push(`Products/Services: ${companyProfile.productsServices}`);
                if (companyProfile.targetCustomers) parts.push(`Target Customers: ${companyProfile.targetCustomers}`);
                if (companyProfile.markets) parts.push(`Markets: ${companyProfile.markets}`);
                if (companyProfile.valueProposition) parts.push(`Value Prop: ${companyProfile.valueProposition}`);
                if (parts.length > 0) activeContext = `\n\nCOMPANY CONTEXT:\n${parts.join('\n')}`;
            }
        }

        // Resolve brain config for the role
        const resolved = await resolveEffectiveBrainConfig(dbUser.companyId, assistantType);

        const brainSystemPrompt = buildBrainSystemPrompt({
            assistantType,
            effectiveConfig: resolved.config,
            advancedInstructions: null,
            companyProfile: activeContext,
            contextText: '',
            aiLanguageName,
        });

        const temperature = getBrainTemperature({ ...resolved.config } as BrainConfig);

        // Fetch selected document content if provided
        let documentContext = '';
        if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
            const { data: docs } = await db
                .from('Document')
                .select('filename, extractedText')
                .in('id', documentIds)
                .eq('companyId', dbUser.companyId);

            if (docs && docs.length > 0) {
                const docTexts = docs
                    .filter(d => d.extractedText)
                    .map(d => `--- Document: ${d.filename} ---\n${d.extractedText!.slice(0, 8000)}`)
                    .join('\n\n');
                if (docTexts) {
                    documentContext = `\n\nATTACHED DOCUMENTS (use this information to fill fields more accurately):\n${docTexts}`;
                }
            }
        }

        // Build team members context for assignee resolution
        let teamContext = '';
        if (teamMembers && Array.isArray(teamMembers) && teamMembers.length > 0) {
            const memberList = teamMembers.map((m: { id: string; name: string }) => `  - "${m.name}" (id: ${m.id})`).join('\n');
            teamContext = `\n\nTEAM MEMBERS (use these to resolve assignee names from the transcript):\n${memberList}`;
        }

        // Build field schema description for the AI
        const fieldDescriptions = Object.entries(fieldSchema as Record<string, string>)
            .map(([key, desc]) => `  "${key}": ${desc}`)
            .join('\n');

        const parsePrompt = `You are an AI assistant that extracts structured information from a spoken voice brief (transcript). The user spoke freely about what they want to accomplish. Your job is to parse and understand their intent and fill in form fields.

FIELD SCHEMA — These are the fields you must extract. Only include fields where the transcript provides enough information:
${fieldDescriptions}

RULES:
1. Return ONLY valid JSON — no prose, no markdown, no code fences
2. Use the exact field keys from the schema above
3. For enum fields, pick the closest matching option from the allowed values
4. For text fields, write clear, refined text based on what the user said (not a word-for-word copy)
5. If the transcript doesn't mention information for a field, OMIT that field from the JSON
6. Write field values in ${aiLanguageName} unless the field is an enum with fixed English values
7. Use the company context to enrich fields where relevant (e.g., products, target market)
8. Be intelligent — infer reasonable defaults from context when the user implies something without saying it explicitly
9. If attached documents are provided, use their content to fill in details the user may have left out or to add precision
10. For the "subtasks" field, ALWAYS generate actionable sub-tasks even if not explicitly mentioned — break down the main task into clear steps. Each subtask should include a realistic time estimate in minutes.
11. For "assigneeId", if the user mentions a person's name, match it against the TEAM MEMBERS list and return the corresponding id. If no match is found, omit the field.
12. Calculate "estimatedEffort" as the total sum of all subtask estimatedMinutes, formatted as a human-readable string (e.g., "2h 30min" or "45min").
${teamContext}${documentContext}
TRANSCRIPT:
"""
${transcript}
"""

Return ONLY the JSON object with extracted fields:`;

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: brainSystemPrompt },
                { role: 'user', content: parsePrompt },
            ],
            max_completion_tokens: 1024,
            temperature: Math.max(temperature - 0.1, 0.1), // Slightly less creative for extraction
        });

        const rawResponse = completion.choices[0]?.message?.content?.trim() || '{}';

        // Parse JSON — strip code fences if the model added them
        let fields: Record<string, string>;
        try {
            const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            fields = JSON.parse(cleaned);
        } catch {
            console.error('[parse-voice-brief] Failed to parse JSON:', rawResponse);
            return NextResponse.json({ error: 'Failed to parse AI response', raw: rawResponse }, { status: 500 });
        }

        return NextResponse.json({ fields });
    } catch (error) {
        console.error('[parse-voice-brief] error:', error);
        return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
    }
}
