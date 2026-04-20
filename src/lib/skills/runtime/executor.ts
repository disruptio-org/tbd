/**
 * ═══════════════════════════════════════════════════════
 * Skill Runtime Executor — Central orchestrator
 * ═══════════════════════════════════════════════════════
 *
 * The main entry point for ChatGPT-compatible skill execution.
 * Validates capabilities, dispatches to the correct executor
 * based on runtimeCategory, records traces, and returns
 * a typed ResultEnvelope.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { validateCompatibility } from '../compatibility-validator';
import { parseSkillManifest } from '../manifest-parser';
import { EnvelopeBuilder, createTextEnvelope } from './result-envelope';
import { executeArtifactSkill } from './artifact-executor';
import type {
    RuntimeCategory,
    ResponseMode,
    ResultEnvelope,
    CapabilityId,
    ArtifactContract,
    ExecutionTrace,
    ExecutionTraceStep,
    DegradationDecision,
    CompatibilityState,
} from '../types';

export interface SkillExecInput {
    companyId: string;
    userId: string;
    skillId: string;
    topic: string;
    language?: string;
    audience?: string;
    tone?: string;
    goal?: string;
    length?: string;
    projectId?: string;
    chainStepIndex?: number;
    previousStepOutput?: string;
}

interface SkillRecord {
    id: string;
    key: string;
    name: string;
    instructionPrompt: string | null;
    importMode: string;
    runtimeCategory: string;
    responseMode: string;
    requiredCapabilities: string[];
    requiredConnectors: string[];
    artifactContracts: ArtifactContract[] | null;
    compatibilityState: string;
}

/**
 * Execute a skill through the runtime engine.
 *
 * If the skill is LEGACY or content-generation, this returns null
 * to signal the caller to use the existing pipeline for backward compat.
 */
export async function executeSkillRuntime(input: SkillExecInput): Promise<ResultEnvelope | null> {
    const db = createAdminClient();
    const traceSteps: ExecutionTraceStep[] = [];
    const degradations: DegradationDecision[] = [];
    const startTime = Date.now();

    // ── 1. Load skill ────────────────────────────────
    const { data: skill } = await db
        .from('AssistantSkill')
        .select('id, key, name, instructionPrompt, importMode, runtimeCategory, responseMode, requiredCapabilities, requiredConnectors, artifactContracts, compatibilityState')
        .eq('id', input.skillId)
        .eq('companyId', input.companyId)
        .maybeSingle();

    if (!skill) {
        return new EnvelopeBuilder('chat')
            .setFailed(`Skill ${input.skillId} not found`)
            .build();
    }

    const skillRecord = skill as unknown as SkillRecord;

    // ── 2. Legacy / content-generation bypass ─────────
    // Return null to signal the caller to use the existing assistant-generate pipeline
    if (skillRecord.importMode === 'LEGACY' || skillRecord.runtimeCategory === 'content-generation') {
        return null;
    }

    traceSteps.push({
        step: 1,
        action: 'skill_loaded',
        detail: `Loaded skill "${skillRecord.name}" (${skillRecord.runtimeCategory})`,
        status: 'success',
    });

    // ── 3. Capability check ──────────────────────────
    const requiredCaps = (skillRecord.requiredCapabilities || []) as CapabilityId[];
    const manifest = parseSkillManifest({
        key: skillRecord.key,
        name: skillRecord.name,
        instructions: skillRecord.instructionPrompt || '',
        sourceFormat: 'md',
    });
    manifest.requiredCapabilities = requiredCaps;
    manifest.artifactContracts = (skillRecord.artifactContracts || []) as ArtifactContract[];

    const compatReport = validateCompatibility(manifest);

    traceSteps.push({
        step: 2,
        action: 'capability_check',
        detail: `Compatibility: ${compatReport.state} (score: ${compatReport.score})`,
        status: compatReport.state === 'INCOMPATIBLE' ? 'error' : 'success',
        data: { issues: compatReport.issues },
    });

    // Block if incompatible
    if (compatReport.state === 'INCOMPATIBLE') {
        const builder = new EnvelopeBuilder(skillRecord.responseMode as ResponseMode);
        builder.setFailed(`Skill cannot execute: ${compatReport.issues.filter(i => i.severity === 'blocking').map(i => i.description).join('; ')}`);
        builder.setTrace(buildTrace(traceSteps, degradations, compatReport.state, startTime));
        return builder.build();
    }

    // Record degradations
    if (compatReport.state === 'COMPATIBLE_DEGRADED') {
        for (const issue of compatReport.issues.filter(i => i.severity === 'degrading')) {
            degradations.push({
                capability: issue.id,
                reason: issue.description,
                substitution: 'Degraded to text-only output for this capability',
                semanticallyIncomplete: true,
            });
        }
    }

    // ── 4. Load company context ──────────────────────
    let companyContext = '';
    try {
        const { data: profile } = await db.from('CompanyProfile')
            .select('companyName, productsServices, targetCustomers, strategicGoals, valueProposition')
            .eq('companyId', input.companyId)
            .maybeSingle();

        if (profile) {
            companyContext = [
                `Company: ${profile.companyName || 'Unknown'}`,
                profile.productsServices ? `Products: ${profile.productsServices}` : '',
                profile.targetCustomers ? `Customers: ${profile.targetCustomers}` : '',
                profile.strategicGoals ? `Goals: ${profile.strategicGoals}` : '',
                profile.valueProposition ? `Value Prop: ${profile.valueProposition}` : '',
            ].filter(Boolean).join('\n');
        }
    } catch { /* optional */ }

    traceSteps.push({
        step: 3,
        action: 'context_loaded',
        detail: companyContext ? 'Company context loaded' : 'No company context available',
        status: 'success',
    });

    // ── 5. Dispatch to executor ──────────────────────
    const category = skillRecord.runtimeCategory as RuntimeCategory;
    let result: ResultEnvelope;

    const skillRunId = crypto.randomUUID();

    try {
        switch (category) {
            case 'artifact-generation': {
                traceSteps.push({ step: 4, action: 'dispatch', detail: 'Dispatching to artifact executor', status: 'success' });
                result = await executeArtifactSkill({
                    companyId: input.companyId,
                    userId: input.userId,
                    skillRunId,
                    skillName: skillRecord.name,
                    instructionPrompt: skillRecord.instructionPrompt || '',
                    topic: input.topic,
                    language: input.language || 'en',
                    companyContext,
                    artifactContracts: manifest.artifactContracts,
                    chainStepIndex: input.chainStepIndex,
                });
                break;
            }

            case 'tool-orchestrated':
            case 'hybrid':
            case 'connector-workflow':
            case 'ui-rendering': {
                // For now, these fall through to a text-generation with warnings
                traceSteps.push({
                    step: 4,
                    action: 'dispatch',
                    detail: `Category "${category}" executing in content-generation fallback mode`,
                    status: 'degraded',
                });

                degradations.push({
                    capability: category,
                    reason: `Full ${category} execution is not yet implemented`,
                    substitution: 'Executed as content-generation skill',
                    semanticallyIncomplete: true,
                });

                // Return null to use existing pipeline with degradation warnings
                return null;
            }

            default:
                return null; // Use existing pipeline
        }
    } catch (err) {
        result = new EnvelopeBuilder(skillRecord.responseMode as ResponseMode)
            .setFailed(`Execution error: ${(err as Error).message}`)
            .build();
    }

    // ── 6. Apply degradation report ──────────────────
    if (degradations.length > 0) {
        result.status = result.status === 'failed' ? 'failed' : 'degraded';
        result.degradationReport = {
            isDegraded: true,
            decisions: degradations,
            summary: `${degradations.length} capability(ies) were degraded during execution`,
        };
    }

    // ── 7. Record execution trace ────────────────────
    result.executionTrace = buildTrace(traceSteps, degradations, compatReport.state, startTime);

    // ── 8. Persist SkillRun ──────────────────────────
    await db.from('SkillRun').insert({
        id: skillRunId,
        skillId: skillRecord.id,
        companyId: input.companyId,
        triggerType: input.chainStepIndex != null ? 'chain' : 'manual',
        status: result.status === 'failed' ? 'failed' : 'success',
        inputPayload: { topic: input.topic, language: input.language, audience: input.audience },
        outputTitle: result.assistantMessage?.substring(0, 200) || skillRecord.name,
        outputText: result.assistantMessage || '',
        modelUsed: result.executionMeta.modelUsed,
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
        responseMode: skillRecord.responseMode,
        executionTrace: result.executionTrace,
        compatibilityCheckResult: compatReport.state,
        degradationFlags: result.degradationReport || null,
        artifactIds: result.artifacts.map(a => a.id),
        uiIntents: result.uiIntents,
        resultEnvelope: result,
    });

    return result;
}

function buildTrace(
    steps: ExecutionTraceStep[],
    degradations: DegradationDecision[],
    compatState: CompatibilityState,
    startTime: number,
): ExecutionTrace {
    return {
        steps,
        capabilityCheckResult: compatState,
        degradationDecisions: degradations,
        toolInvocations: [],
        connectorInvocations: [],
        totalDurationMs: Date.now() - startTime,
    };
}
