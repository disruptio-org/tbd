// ─── POST /api/ai/brains/test — Test a prompt against a brain ──

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { resolveEffectiveBrainConfig } from '@/lib/ai-brains/resolve-effective-brain';
import { buildBrainSystemPrompt, getBrainTemperature } from '@/lib/ai-brains/build-brain-prompt';
import { getAiLanguageName } from '@/i18n';
import type { BrainConfig } from '@/lib/ai-brains/schema';

const CHAT_MODEL = 'gpt-5.4-mini';

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

        const body = await request.json();
        const { brainProfileId, assistantType, prompt, useDraft } = body;
        if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

        // Get company language
        const { data: companyData } = await db.from('Company').select('language').eq('id', dbUser.companyId).maybeSingle();
        const companyLang = (companyData?.language as 'en' | 'pt-PT' | 'fr') || 'en';
        const aiLanguageName = getAiLanguageName(companyLang);

        let effectiveConfig: BrainConfig;
        let brainId = brainProfileId;
        let versionId: string | null = null;

        if (brainProfileId && useDraft) {
            // Load draft config directly from the brain profile
            const { data: brain } = await db
                .from('AIBrainProfile')
                .select('configJson, advancedInstructions')
                .eq('id', brainProfileId)
                .eq('companyId', dbUser.companyId)
                .maybeSingle();

            if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
            effectiveConfig = brain.configJson as unknown as BrainConfig;
        } else {
            // Use the runtime-resolved effective config
            const resolved = await resolveEffectiveBrainConfig(dbUser.companyId, assistantType || 'GENERAL');
            effectiveConfig = resolved.config;
            brainId = resolved.companyBrainId || resolved.roleBrainId;
            versionId = resolved.companyBrainVersionId || resolved.roleBrainVersionId;
        }

        // Build system prompt
        const systemPrompt = buildBrainSystemPrompt({
            assistantType: assistantType || 'GENERAL',
            effectiveConfig,
            advancedInstructions: null,
            companyProfile: '',
            contextText: '',
            aiLanguageName,
        });

        // Get temperature from brain config
        const temperature = getBrainTemperature({ ...effectiveConfig } as BrainConfig);

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            max_completion_tokens: 1024,
            temperature,
        });

        const responseText = completion.choices[0]?.message?.content || 'Unable to generate a response.';

        // Save test run
        if (brainId) {
            void (async () => {
                try {
                    await db.from('AIBrainTestRun').insert({
                        id: crypto.randomUUID(),
                        companyId: dbUser.companyId,
                        brainProfileId: brainId,
                        brainVersionId: versionId,
                        assistantType: assistantType || 'GENERAL',
                        inputPrompt: prompt,
                        responseText,
                        metadataJson: { temperature, useDraft },
                        createdById: dbUser.id,
                        createdAt: new Date().toISOString(),
                    });
                } catch (err) {
                    console.error('[ai/brains/test] save test run error:', err);
                }
            })();
        }

        return NextResponse.json({
            response: responseText,
            effectiveConfig,
            brainProfileId: brainId,
            brainVersionId: versionId,
            temperature,
        });
    } catch (error) {
        console.error('[ai/brains/test] error:', error);
        return NextResponse.json({ error: 'Test failed' }, { status: 500 });
    }
}
