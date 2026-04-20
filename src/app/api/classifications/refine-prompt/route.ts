import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/classifications/refine-prompt
 * Takes a rough user prompt and refines it into an optimal AI extraction prompt.
 */
export async function POST(req: Request) {
    try {
        const auth = await getCurrentUser();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt } = await req.json();

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-5.4',
            temperature: 0.4,
            messages: [
                {
                    role: 'system',
                    content: `You are a prompt engineering expert specializing in document data extraction. 
Your job is to take a rough, informal user description and transform it into a clear, structured, and precise AI extraction prompt.

Rules:
- Keep the same language as the input (Portuguese or English)
- Make the prompt specific about what fields to extract
- Include expected data types and formats where relevant
- Add edge-case handling instructions (e.g., "if not found, return null")
- Keep it concise but comprehensive
- Return ONLY the refined prompt text, nothing else — no quotes, no explanation`,
                },
                {
                    role: 'user',
                    content: `Refine this rough extraction prompt into a professional, structured AI prompt:\n\n"${prompt.trim()}"`,
                },
            ],
        });

        const refined = completion.choices[0]?.message?.content?.trim() || prompt;

        return NextResponse.json({ refined });
    } catch (error) {
        console.error('[refine-prompt] Error:', error);
        return NextResponse.json({ error: 'Failed to refine prompt' }, { status: 500 });
    }
}
