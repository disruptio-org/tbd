// ─── POST /api/ai/rewrite — Rewrite/improve a field using a brain ──

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
        const { text, fieldLabel, brainType } = body;

        if (!text || !brainType) {
            return NextResponse.json({ error: 'text and brainType are required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

        // Get company language
        const { data: companyData } = await db.from('Company').select('language').eq('id', dbUser.companyId).maybeSingle();
        const companyLang = (companyData?.language as 'en' | 'pt-PT' | 'fr') || 'en';
        const aiLanguageName = getAiLanguageName(companyLang);

        // Resolve the brain config for this assistant type
        const resolved = await resolveEffectiveBrainConfig(dbUser.companyId, brainType);

        // Build system prompt using brain config
        const brainSystemPrompt = buildBrainSystemPrompt({
            assistantType: brainType,
            effectiveConfig: resolved.config,
            advancedInstructions: null,
            companyProfile: '',
            contextText: '',
            aiLanguageName,
        });

        const temperature = getBrainTemperature({ ...resolved.config } as BrainConfig);

        // Build the rewrite prompt
        const rewritePrompt = `You are helping a user improve a form field input. The field is labeled "${fieldLabel || 'text input'}".

Your task: Rewrite and improve the text below to be more clear, professional, and effective for its purpose. Keep the same intent and key information, but make it better written.

IMPORTANT RULES:
- Return ONLY the improved text, nothing else
- Do not add quotes, labels, or explanations
- Keep approximately the same length (do not make it significantly longer)
- Write in ${aiLanguageName}
- Match the tone and style defined in your brain configuration

Text to improve:
${text}`;

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: brainSystemPrompt },
                { role: 'user', content: rewritePrompt },
            ],
            max_completion_tokens: 512,
            temperature: Math.min(temperature + 0.1, 1.0), // Slightly more creative for rewrites
        });

        const rewritten = completion.choices[0]?.message?.content?.trim() || text;

        return NextResponse.json({ rewritten });
    } catch (error) {
        console.error('[ai/rewrite] error:', error);
        return NextResponse.json({ error: 'Rewrite failed' }, { status: 500 });
    }
}
