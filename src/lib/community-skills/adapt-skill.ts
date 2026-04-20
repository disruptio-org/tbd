/**
 * Adapt a raw community SKILL.md instruction prompt for Nousio's generation pipeline.
 *
 * Raw skills from Claude Code / Antigravity / Cursor reference tools (terminal, browser,
 * file-system) that don't exist in Nousio. They also don't produce the structured JSON
 * output (title, content, summary) that assistant-generate.ts expects.
 *
 * This adapter uses GPT to rewrite the instructions at import time so the skill
 * works seamlessly with Nousio's OpenAI-powered generation pipeline.
 */

import OpenAI from 'openai';

const MODEL = 'gpt-5.4-mini';

const ADAPTATION_PROMPT = `You are an AI skill adapter. Your job is to rewrite raw coding-agent skill instructions so they work inside a business content generation platform called "Nousio."

CONTEXT ABOUT NOUSIO:
- Nousio is a web-based AI assistant platform for business teams (marketing, sales, product).
- It generates content using OpenAI models with structured JSON output.
- Each skill produces: a title, structured body content (with sections), and a one-line summary.
- The platform injects company context (profile, brand, products) and user parameters (audience, tone, language, length) into every generation.
- There is NO terminal, NO file system, NO browser automation. Everything is text-in, content-out.

YOUR TASK:
Rewrite the raw skill instructions below to work in Nousio. Follow these rules:

1. PRESERVE the domain expertise, best practices, and quality standards from the original skill.
2. REMOVE references to: terminal commands, file paths, file creation, npm/pip, git, browser automation, code execution, debugging, testing, deployments.
3. REMOVE model-specific syntax: Claude artifacts, tool_use blocks, MCP references, slash commands.
4. REFRAME for content generation: Instead of "create a React component", say "design and describe a UI component layout with detailed specifications." Instead of "run tests", say "include a quality checklist."
5. ADD these Nousio-specific instructions at the end:
   - "Use the provided company context to tailor content to the company's brand, products, and market position."
   - "Adapt your tone and language to match the specified audience and communication style."
   - "Structure your output with clear headings and organized sections for readability."
6. Keep the rewritten instructions concise — under 2000 words.
7. Return ONLY the rewritten instructions. No explanations, no meta-commentary.`;

export async function adaptSkillForNousio(
    rawInstructions: string,
    skillMeta: { name: string; description?: string },
): Promise<{ adapted: string; success: boolean; error?: string }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { adapted: rawInstructions, success: false, error: 'OPENAI_API_KEY not configured' };
    }

    try {
        const openai = new OpenAI({ apiKey });

        const userMessage = [
            `Skill name: ${skillMeta.name}`,
            skillMeta.description ? `Description: ${skillMeta.description}` : '',
            '',
            '--- RAW INSTRUCTIONS ---',
            rawInstructions,
        ].filter(Boolean).join('\n');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: ADAPTATION_PROMPT,
            input: userMessage,
            temperature: 0.3,
        });

        const adapted = response.output_text?.trim();
        if (!adapted) {
            return { adapted: rawInstructions, success: false, error: 'Empty response from adaptation' };
        }

        return { adapted, success: true };
    } catch (err) {
        console.error('[adapt-skill] Adaptation failed:', err);
        return {
            adapted: rawInstructions,
            success: false,
            error: `Adaptation failed: ${(err as Error).message}`,
        };
    }
}
