import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const SEARCH_MODEL = 'gpt-5.4-mini';
const MAX_LEADS = 20;

/**
 * POST /api/leads/discover
 * AI-powered lead discovery using company context + web search.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    try {
        const body = await request.json();
        const {
            query,
            productsServices,
            targetCustomers,
            markets,
            industry,
            geography,
            companySize,
            desiredLeadCount = 10,
            mustHaveCriteria,
            excludeCriteria,
            projectId,
        } = body;

        if (!query?.trim()) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const leadCount = Math.min(Math.max(Number(desiredLeadCount) || 10, 1), MAX_LEADS);

        const db = createAdminClient();
        const openai = new OpenAI({ apiKey });

        // 1. Load Company Profile for context
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

        // 2. Build company context string
        const contextParts: string[] = [];

        if (projectId) {
            const { data: project } = await db.from('Project').select('name, description, contextText').eq('id', projectId).eq('companyId', auth.dbUser.companyId).maybeSingle();
            if (project) {
                contextParts.push('=== OUR PROJECT DATA ===');
                if (project.name) contextParts.push(`Project Name: ${project.name}`);
                if (project.description) contextParts.push(`Description: ${project.description}`);
                if (project.contextText) contextParts.push(`Context: ${project.contextText}`);
            }
        } else {
            if (profile) {
                contextParts.push('=== OUR COMPANY PROFILE ===');
                if (profile.companyName) contextParts.push(`Company Name: ${profile.companyName}`);
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
                contextParts.push(`=== OUR COMPANY ===`);
                contextParts.push(`Company Name: ${company.name}`);
                if (company.website) contextParts.push(`Website: ${company.website}`);
            }

            if (company?.webContext) {
                contextParts.push(`\nWeb Context:\n${company.webContext}`);
            }
        }

        // User-provided overrides from form
        contextParts.push('\n=== SEARCH CRITERIA ===');
        contextParts.push(`Discovery Goal: ${query}`);
        if (productsServices) contextParts.push(`Products/Services to Sell: ${productsServices}`);
        if (targetCustomers) contextParts.push(`Target Customers: ${targetCustomers}`);
        if (markets) contextParts.push(`Markets: ${markets}`);
        if (industry) contextParts.push(`Target Industry: ${industry}`);
        if (geography) contextParts.push(`Geography: ${geography}`);
        if (companySize) contextParts.push(`Company Size: ${companySize}`);
        if (mustHaveCriteria) contextParts.push(`Must-have criteria: ${mustHaveCriteria}`);
        if (excludeCriteria) contextParts.push(`Exclude criteria: ${excludeCriteria}`);
        contextParts.push(`Number of leads requested: ${leadCount}`);

        const companyContext = contextParts.join('\n');

        // 3. Create search run record
        const searchRunId = crypto.randomUUID();
        const searchTitle = query.length > 80 ? query.substring(0, 80) + '…' : query;

        await db.from('LeadSearchRun').insert({
            id: searchRunId,
            companyId: auth.dbUser.companyId,
            userId: auth.dbUser.id,
            title: searchTitle,
            query,
            searchContext: {
                productsServices,
                targetCustomers,
                markets,
                industry,
                geography,
                companySize,
                desiredLeadCount: leadCount,
                mustHaveCriteria,
                excludeCriteria,
            },
            status: 'running',
            updatedAt: new Date().toISOString(),
        });

        // 4. Call OpenAI with web search to discover leads
        const systemPrompt = `You are an expert B2B lead discovery analyst. Your task is to identify real, specific companies that are potential business leads for the user's company.

INSTRUCTIONS:
1. Use the company profile and search criteria provided below to understand what the user's company sells and who they target.
2. Search the web for REAL companies that match the criteria.
3. For each lead, explain WHY it is a good fit based on evidence found online.
4. Suggest a practical outreach approach for each lead.
5. Identify likely buyer roles/functions within each company.

RULES:
- Only include REAL companies you can verify exist.
- Do NOT invent or fabricate company names, websites, or contact information.
- Do NOT invent email addresses or phone numbers.
- If evidence is weak for a company, note low confidence.
- Provide source URLs when available.
- Rank leads by relevance (most relevant first).
- Return EXACTLY the number of leads requested (or fewer if you cannot find enough quality matches).

${companyContext}`;

        // Use the Responses API with web_search_preview tool and JSON schema enforcement
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: SEARCH_MODEL,
            tools: [{ type: 'web_search_preview', search_context_size: 'high' }],
            instructions: systemPrompt,
            input: `Find ${leadCount} potential business leads matching my criteria. Search the web for real companies. My search goal: "${query}"`,
            temperature: 0.4,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'lead_discovery_results',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            leads: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        companyName: { type: 'string', description: 'Name of the company' },
                                        website: { type: ['string', 'null'], description: 'Company website URL' },
                                        industry: { type: 'string', description: 'Industry or sector' },
                                        location: { type: 'string', description: 'Company location' },
                                        summary: { type: 'string', description: 'Brief description of the company' },
                                        whyFit: { type: 'string', description: 'Why this company is a good prospect' },
                                        suggestedApproach: { type: 'string', description: 'How to approach this lead' },
                                        likelyContactRoles: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: 'Likely buyer roles/functions'
                                        },
                                        sourceLinks: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    title: { type: 'string' },
                                                    url: { type: 'string' }
                                                },
                                                required: ['title', 'url'],
                                                additionalProperties: false
                                            },
                                            description: 'Source URLs supporting this lead'
                                        },
                                        relevanceScore: { type: 'number', description: 'Relevance score 0-100' }
                                    },
                                    required: ['companyName', 'website', 'industry', 'location', 'summary', 'whyFit', 'suggestedApproach', 'likelyContactRoles', 'sourceLinks', 'relevanceScore'],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ['leads'],
                        additionalProperties: false
                    }
                }
            }
        });

        // Extract text from Responses API
        const rawContent = response.output_text || '';
        console.log('[leads/discover] Raw content length:', rawContent.length);
        console.log('[leads/discover] Raw content preview:', rawContent.substring(0, 300));

        // 5. Parse AI response (should be clean JSON thanks to json_schema)
        let leads: Array<{
            companyName: string;
            website?: string | null;
            industry?: string;
            location?: string;
            summary?: string;
            whyFit?: string;
            suggestedApproach?: string;
            likelyContactRoles?: string[];
            sourceLinks?: Array<{ title: string; url: string }>;
            relevanceScore?: number;
        }> = [];

        try {
            const parsed = JSON.parse(rawContent);
            // The schema wraps leads in a { leads: [...] } object
            leads = Array.isArray(parsed.leads) ? parsed.leads : (Array.isArray(parsed) ? parsed : []);
        } catch (parseErr) {
            console.error('[leads/discover] Failed to parse AI response:', parseErr);
            console.log('[leads/discover] Raw content (full):', rawContent.substring(0, 3000));

            // Update run as failed
            await db.from('LeadSearchRun')
                .update({ status: 'failed', updatedAt: new Date().toISOString() })
                .eq('id', searchRunId);

            return NextResponse.json({
                searchRunId,
                results: [],
                error: 'Failed to parse AI response. Please try again.',
            }, { status: 200 });
        }

        // 6. Deduplicate by company name (case-insensitive)
        const seen = new Set<string>();
        leads = leads.filter(lead => {
            const key = lead.companyName?.toLowerCase().trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // 7. Save lead results
        const resultRecords = leads.map((lead, index) => ({
            id: crypto.randomUUID(),
            searchRunId,
            companyId: auth.dbUser.companyId,
            companyName: lead.companyName || 'Unknown',
            website: lead.website || null,
            industry: lead.industry || null,
            location: lead.location || null,
            summary: lead.summary || null,
            whyFit: lead.whyFit || null,
            suggestedApproach: lead.suggestedApproach || null,
            likelyContactRoles: lead.likelyContactRoles || [],
            sourceLinks: lead.sourceLinks || [],
            relevanceScore: lead.relevanceScore ?? (100 - index * 5),
            status: 'active',
            updatedAt: new Date().toISOString(),
        }));

        if (resultRecords.length > 0) {
            const { error: insertError } = await db.from('LeadResult').insert(resultRecords);
            if (insertError) {
                console.error('[leads/discover] Failed to save results:', insertError);
            }
        }

        // 8. Mark run as completed
        await db.from('LeadSearchRun')
            .update({ status: 'completed', updatedAt: new Date().toISOString() })
            .eq('id', searchRunId);

        // 9. Return response
        return NextResponse.json({
            searchRunId,
            results: resultRecords.map(r => ({
                id: r.id,
                companyName: r.companyName,
                website: r.website,
                industry: r.industry,
                location: r.location,
                summary: r.summary,
                whyFit: r.whyFit,
                suggestedApproach: r.suggestedApproach,
                likelyContactRoles: r.likelyContactRoles,
                sourceLinks: r.sourceLinks,
                relevanceScore: r.relevanceScore,
            })),
        });

    } catch (error) {
        console.error('[leads/discover] Error:', error);
        return NextResponse.json(
            { error: 'Lead discovery failed', detail: String(error) },
            { status: 500 }
        );
    }
}
