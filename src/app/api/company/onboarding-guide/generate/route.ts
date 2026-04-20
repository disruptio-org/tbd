import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const CHAT_MODEL = 'gpt-5.4-mini';

/**
 * POST /api/company/onboarding-guide/generate
 * Generates an AI-powered onboarding summary using CompanyProfile + curated documents.
 * Stores (upserts) the result in CompanyOnboardingGuide.
 */
export async function POST() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    try {
        // 1. Fetch CompanyProfile
        const { data: profile } = await db
            .from('CompanyProfile')
            .select('*')
            .eq('companyId', companyId)
            .maybeSingle();

        // 2. Fetch curated knowledge documents (onboarding, company, product, process categories)
        const ONBOARDING_CATEGORIES = ['onboarding', 'company', 'product', 'process', 'hr', 'policy'];
        const { data: docs } = await db
            .from('Document')
            .select('id, filename, extractedText, knowledgeCategory, useAsKnowledgeSource')
            .eq('companyId', companyId)
            .eq('ocrProcessed', true)
            .not('extractedText', 'is', null);

        // Prioritise knowledge sources and onboarding-relevant categories
        const relevantDocs = (docs || [])
            .filter(d =>
                d.useAsKnowledgeSource ||
                ONBOARDING_CATEGORIES.includes((d.knowledgeCategory || '').toLowerCase())
            )
            .slice(0, 10); // Cap at 10 documents

        // 3. Build context
        const profileContext = profile ? `
COMPANY PROFILE:
Company Name: ${profile.companyName}
Description: ${profile.description}
Industry: ${profile.industry || 'N/A'}
Products & Services: ${profile.productsServices || 'N/A'}
Main Offerings: ${profile.mainOfferings || 'N/A'}
Value Proposition: ${profile.valueProposition || 'N/A'}
Target Customers: ${profile.targetCustomers || 'N/A'}
Target Industries: ${profile.targetIndustries || 'N/A'}
Markets: ${profile.markets || 'N/A'}
Departments: ${profile.departments || 'N/A'}
Internal Tools: ${profile.internalTools || 'N/A'}
Key Processes: ${profile.keyProcesses || 'N/A'}
Strategic Goals: ${profile.strategicGoals || 'N/A'}
Brand Tone: ${profile.brandTone || 'N/A'}
`.trim() : '';

        const docsContext = relevantDocs.length > 0
            ? relevantDocs
                .map(d => `[${d.filename}]\n${(d.extractedText || '').substring(0, 800)}`)
                .join('\n\n---\n\n')
            : '';

        if (!profileContext && !docsContext) {
            return NextResponse.json(
                { error: 'No company profile or relevant documents found. Please fill in the Company Profile first.' },
                { status: 422 }
            );
        }

        // 4. Generate summary via AI
        const openai = new OpenAI({ apiKey });

        const systemPrompt = `You are an expert at creating clear, welcoming onboarding summaries for new employees.
Generate a concise, structured onboarding summary for a new employee joining this company.
The summary should cover:
1. What the company does (brief, clear)
2. Main products or services
3. Who the company's customers are
4. Key internal departments or teams
5. The most important tools used internally
6. Key processes or ways of working
7. What the employee should understand first

Use plain language. Be concise. Use bullet points where helpful. Write in ${profile?.brandTone ? `a ${profile.brandTone} tone` : 'a professional, welcoming tone'}.
Do not invent facts not present in the provided context. If information is missing, skip that section.`;

        const userPrompt = `Based on the following company information, generate an onboarding summary:

${profileContext}
${docsContext ? `\nCOMPANY DOCUMENTS:\n${docsContext}` : ''}

Write the summary in the same language as the company description (Portuguese if the content is in Portuguese, English otherwise).`;

        const completion = await openai.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 1200,
            temperature: 0.4,
        });

        const summary = completion.choices[0]?.message?.content || '';
        if (!summary) {
            return NextResponse.json({ error: 'AI failed to generate summary' }, { status: 500 });
        }

        // 5. Determine recommended doc IDs (top knowledge sources or onboarding-category docs)
        const recommendedDocIds = relevantDocs.slice(0, 5).map(d => d.id);

        // 6. Upsert guide
        const { data: existing } = await db
            .from('CompanyOnboardingGuide')
            .select('id')
            .eq('companyId', companyId)
            .maybeSingle();

        const guideData = {
            companyId,
            summary,
            recommendedDocIds,
            generatedFromProfile: !!profile,
            generatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        let guide;
        if (existing) {
            const { data } = await db
                .from('CompanyOnboardingGuide')
                .update(guideData)
                .eq('companyId', companyId)
                .select()
                .single();
            guide = data;
        } else {
            const { data } = await db
                .from('CompanyOnboardingGuide')
                .insert({ id: crypto.randomUUID(), ...guideData })
                .select()
                .single();
            guide = data;
        }

        return NextResponse.json({ guide });
    } catch (err) {
        console.error('[/api/company/onboarding-guide/generate POST]', err);
        return NextResponse.json({ error: 'Failed to generate onboarding guide', detail: String(err) }, { status: 500 });
    }
}
