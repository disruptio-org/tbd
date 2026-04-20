import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Strip HTML tags, collapse whitespace, trim to limit */
function extractText(html: string, limit = 12000): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, limit);
}

async function fetchPageText(url: string): Promise<string> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NousioBot/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
        });
        clearTimeout(timeout);
        if (!res.ok) return '';
        const html = await res.text();
        return extractText(html);
    } catch {
        return '';
    }
}

/**
 * POST /api/backoffice/companies/[id]/scrape-web
 * Fetches the company website and LinkedIn page, summarises with gpt-5.4-mini,
 * and saves the result as `webContext` on the Company record.
 */
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        // Fetch company to get URLs
        const { data: company, error: companyErr } = await db
            .from('Company')
            .select('id, name, website, linkedinUrl')
            .eq('id', id)
            .single();

        if (companyErr || !company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        const { website, linkedinUrl, name } = company as {
            id: string;
            name: string;
            website: string | null;
            linkedinUrl: string | null;
        };

        if (!website && !linkedinUrl) {
            return NextResponse.json(
                { error: 'No website or LinkedIn URL configured for this company' },
                { status: 400 }
            );
        }

        // Fetch page texts in parallel
        const [websiteText, linkedinText] = await Promise.all([
            website ? fetchPageText(website) : Promise.resolve(''),
            linkedinUrl ? fetchPageText(linkedinUrl) : Promise.resolve(''),
        ]);

        const combinedText = [
            website && websiteText ? `--- WEBSITE (${website}) ---\n${websiteText}` : '',
            linkedinUrl && linkedinText ? `--- LINKEDIN (${linkedinUrl}) ---\n${linkedinText}` : '',
        ]
            .filter(Boolean)
            .join('\n\n');

        if (!combinedText.trim()) {
            return NextResponse.json(
                { error: 'Could not extract text from the provided URLs. The pages may be blocked or empty.' },
                { status: 422 }
            );
        }

        // Ask GPT to extract a structured company profile
        const completion = await openai.chat.completions.create({
            model: 'gpt-5.4-mini',
            temperature: 0.3,
            max_completion_tokens: 800,
            messages: [
                {
                    role: 'system',
                    content: `You are a business analyst. Extract a structured, factual company profile from raw website text. Be concise and accurate. Use the language that matches the website content (Portuguese or English). If information is not present, omit it.`,
                },
                {
                    role: 'user',
                    content: `Company name: ${name}\n\nRaw text from website/LinkedIn:\n\n${combinedText}\n\n---\nExtract the following in plain text (not JSON):\n- What the company does (1-2 sentences)\n- Industry / sector\n- Key products or services (bullet list)\n- Target market / customers\n- Value proposition\n- Founding year (if mentioned)\n- Team size or notable facts (if mentioned)\n- Contact or location info (if present)`,
                },
            ],
        });

        const webContext = completion.choices[0]?.message?.content?.trim() ?? '';

        // Save to DB
        const { error: updateErr } = await db
            .from('Company')
            .update({ webContext, updatedAt: new Date().toISOString() })
            .eq('id', id);

        if (updateErr) throw updateErr;

        return NextResponse.json({
            success: true,
            contextLength: webContext.length,
            webContext,
        });
    } catch (err) {
        console.error('[scrape-web POST]', err);
        return NextResponse.json({ error: 'Scraping failed' }, { status: 500 });
    }
}
