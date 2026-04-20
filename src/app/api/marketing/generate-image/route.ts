import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import OpenAI from 'openai';

/**
 * POST /api/marketing/generate-image
 * AI-powered realistic image generation using DALL-E 3.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    try {
        const body = await request.json();
        const {
            topic,
            audience,
            contentSummary,
            contentType
        } = body;

        if (!topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }

        const openai = new OpenAI({ apiKey });

        let prompt = `A highly realistic, professional, and visually appealing photograph or high-quality render suitable for a ${contentType === 'LINKEDIN_POST' ? 'LinkedIn post' : 'blog article'}.`;
        
        prompt += `\nThe core concept is about: ${topic}.`;
        
        if (contentSummary) {
            prompt += `\nThe image should support this key message: ${contentSummary}.`;
        }
        
        if (audience) {
            prompt += `\nTarget audience to resonate with: ${audience}.`;
        }

        prompt += `\nStyle constraints: Clean, modern corporate aesthetics, hyper-realistic, photorealistic lighting, no messy AI text artifacts, polished and suitable for B2B marketing.`;

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "hd",
            style: "natural", // Natural style instead of vivid for more professional realistic images
        });

        const imageUrl = response.data?.[0]?.url;

        if (!imageUrl) {
            throw new Error('No image URL returned from OpenAI');
        }

        return NextResponse.json({
            imageUrl,
            promptUsed: prompt
        });

    } catch (error) {
        console.error('[marketing/generate-image] Error:', error);
        return NextResponse.json({ 
            error: 'Image generation failed', 
            detail: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
