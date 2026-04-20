// ═══════════════════════════════════════════════════════
// API: /api/ai/skills/[id]/train — AI Training Endpoint
// Reads training materials + current prompt, generates improved prompt
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.dbUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { id } = await context.params;
    const db = createAdminClient();

    // Load the skill
    const { data: skill, error } = await db
        .from('AssistantSkill')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (error || !skill) {
        return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Get training materials
    const materials = (skill.trainingMaterials || []) as { id: string; filename: string; textContent: string; uploadedAt: string }[];

    if (materials.length === 0) {
        return NextResponse.json({ error: 'No training materials uploaded. Add files first.' }, { status: 400 });
    }

    // Build training content
    const trainingContent = materials.map((m, i) =>
        `### Training Material ${i + 1}: "${m.filename}"\n\n${m.textContent}`
    ).join('\n\n---\n\n');

    const currentPrompt = skill.instructionPrompt || '(No instruction prompt set yet)';

    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.4,
            messages: [
                {
                    role: 'system',
                    content: `You are an expert AI Skills Architect. Your job is to improve AI instruction prompts by incorporating knowledge from training materials.

You will receive:
1. The CURRENT instruction prompt for a skill
2. One or more TRAINING MATERIALS (transcripts, articles, guides, best practices)

Your task: Produce an IMPROVED instruction prompt that:
- Preserves the core structure and intent of the original prompt
- Absorbs key techniques, best practices, patterns, and knowledge from the training materials
- Adds specific actionable instructions derived from the training content
- Maintains a clear, structured format with sections, rules, and examples
- Is practical and directly usable as an AI instruction prompt
- Does NOT reference the training materials themselves — integrate the knowledge naturally

Output ONLY the improved instruction prompt text. No preamble, no explanation, no commentary.`,
                },
                {
                    role: 'user',
                    content: `## Current Instruction Prompt

${currentPrompt}

---

## Training Materials

${trainingContent}

---

Please produce the improved instruction prompt:`,
                },
            ],
        });

        const improvedPrompt = response.choices[0]?.message?.content?.trim();

        if (!improvedPrompt) {
            return NextResponse.json({ error: 'AI did not generate a response' }, { status: 500 });
        }

        return NextResponse.json({ improvedPrompt });
    } catch (err) {
        console.error('[api/ai/skills/[id]/train] Error:', err);
        return NextResponse.json({ error: 'Training failed — please try again' }, { status: 500 });
    }
}
