/**
 * Skill Chain Executor — runs multi-step skill workflows.
 *
 * A "chain" is an ordered sequence of skill keys where the output of each step
 * feeds into the next step as context. This enables workflows like:
 *   Research → Draft → Review → Publish
 *
 * Chain config is stored as JSON in AssistantSkill.defaultParams.chain:
 *   { "chain": ["research", "draft_article", "copy_review"] }
 *
 * Each step runs through the normal generation pipeline. The previous step's
 * output is prepended to the next step's topic as context.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const MODEL = 'gpt-5.4';

export interface ChainStep {
    skillKey: string;
    skillName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    inputContext?: string;
    output?: string;
    error?: string;
    durationMs?: number;
    // Runtime extensions
    runtimeCategory?: string;
    responseMode?: string;
    artifactIds?: string[];
    resultEnvelope?: unknown;
}

export interface ChainResult {
    chainId: string;
    status: 'completed' | 'partial' | 'failed';
    steps: ChainStep[];
    finalOutput: string;
    totalDurationMs: number;
    // Runtime extensions
    allArtifactIds: string[];
}

/**
 * Load a chain definition from a skill's defaultParams.
 */
export async function loadChainDefinition(
    companyId: string,
    skillKey: string,
): Promise<string[] | null> {
    const db = createAdminClient();
    const { data: skill } = await db
        .from('AssistantSkill')
        .select('defaultParams')
        .eq('companyId', companyId)
        .eq('key', skillKey)
        .eq('status', 'ACTIVE')
        .maybeSingle();

    if (!skill?.defaultParams) return null;
    const params = skill.defaultParams as Record<string, unknown>;
    const chain = params.chain as string[] | undefined;
    return chain && Array.isArray(chain) && chain.length > 1 ? chain : null;
}

/**
 * Execute a skill chain.
 * Each step runs the skill's instructionPrompt with the previous output as context.
 */
export async function executeChain(
    companyId: string,
    chainSkillKeys: string[],
    initialTopic: string,
    context: {
        userId: string;
        language: string;
        companyProfile?: string;
        projectId?: string;
    },
): Promise<ChainResult> {
    const db = createAdminClient();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const openai = new OpenAI({ apiKey });
    const chainId = crypto.randomUUID();
    const steps: ChainStep[] = [];
    let currentContext = initialTopic;
    const chainStart = Date.now();

    // Load all skills in the chain
    const { data: skills } = await db
        .from('AssistantSkill')
        .select('key, name, instructionPrompt, runtimeCategory, responseMode, importMode')
        .eq('companyId', companyId)
        .eq('status', 'ACTIVE')
        .in('key', chainSkillKeys);

    const skillMap: Record<string, { name: string; instructionPrompt: string; runtimeCategory?: string; responseMode?: string; importMode?: string }> = {};
    (skills || []).forEach(s => {
        skillMap[s.key] = { name: s.name, instructionPrompt: s.instructionPrompt || '', runtimeCategory: s.runtimeCategory, responseMode: s.responseMode, importMode: s.importMode };
    });

    for (const skillKey of chainSkillKeys) {
        const skill = skillMap[skillKey];
        if (!skill) {
            steps.push({
                skillKey,
                skillName: skillKey,
                status: 'failed',
                error: `Skill "${skillKey}" not found or inactive`,
            });
            continue;
        }

        const step: ChainStep = {
            skillKey,
            skillName: skill.name,
            status: 'running',
            inputContext: currentContext.substring(0, 500) + (currentContext.length > 500 ? '...' : ''),
            runtimeCategory: skill.runtimeCategory || 'content-generation',
            responseMode: skill.responseMode || 'chat',
        };

        const stepStart = Date.now();

        try {
            // Retrieve wiki context for this step
            let wikiBlock = '';
            try {
                const { retrieveWikiContext } = await import('@/lib/wiki/retriever');
                const wikiResult = await retrieveWikiContext(companyId, currentContext.substring(0, 200), { projectId: context.projectId });
                wikiBlock = wikiResult.formattedContext;
            } catch { /* wiki retrieval optional */ }

            // Build prompt with chain context
            const chainPrompt = `${skill.instructionPrompt}

=== INPUT FROM PREVIOUS STEP ===
${currentContext}

=== YOUR TASK ===
Process the input above according to the skill instructions. Produce structured, actionable output.
Write in ${context.language}.`;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (openai as any).responses.create({
                model: MODEL,
                instructions: `You are a specialized assistant executing step "${skill.name}" in a multi-step workflow.
${context.companyProfile ? '\n' + context.companyProfile : ''}${wikiBlock}`,
                input: chainPrompt,
                temperature: 0.6,
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'chain_step_output',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                content: { type: 'string' },
                                summary: { type: 'string' },
                            },
                            required: ['title', 'content', 'summary'],
                            additionalProperties: false,
                        },
                    },
                },
            });

            const raw = response.output_text || '{}';
            const parsed = JSON.parse(raw);

            step.output = parsed.content || raw;
            step.status = 'completed';
            step.durationMs = Date.now() - stepStart;

            // Feed output to next step
            currentContext = `## ${parsed.title || skill.name}\n${step.output}\n\nSummary: ${parsed.summary || ''}`;
        } catch (err) {
            step.status = 'failed';
            step.error = String(err);
            step.durationMs = Date.now() - stepStart;
        }

        steps.push(step);

        // Stop chain if a step fails
        if (step.status === 'failed') break;
    }

    const allCompleted = steps.every(s => s.status === 'completed');
    const anyCompleted = steps.some(s => s.status === 'completed');

    // Save chain run
    await db.from('GeneralAIGenerationRun').insert({
        id: chainId,
        companyId,
        userId: context.userId,
        contentType: `chain_${chainSkillKeys[0]}`,
        title: `Chain: ${steps.map(s => s.skillName).join(' → ')}`,
        inputPrompt: initialTopic,
        generationContext: { chainSteps: steps.map(s => ({ key: s.skillKey, name: s.skillName, status: s.status })) },
        outputText: currentContext,
        language: context.language,
        status: allCompleted ? 'completed' : 'failed',
        updatedAt: new Date().toISOString(),
    });

    // Collect all artifact IDs from chain steps
    const allArtifactIds = steps.flatMap(s => s.artifactIds || []);

    return {
        chainId,
        status: allCompleted ? 'completed' : anyCompleted ? 'partial' : 'failed',
        steps,
        finalOutput: currentContext,
        totalDurationMs: Date.now() - chainStart,
        allArtifactIds,
    };
}
