// ═══════════════════════════════════════════════════════
// AI BRAINS — Built-in Preset Templates
// ═══════════════════════════════════════════════════════

import type { BrainConfig } from './schema';
import { DEFAULT_COMPANY_BRAIN_CONFIG } from './defaults';

// ─── Template Definition ──────────────────────────────

export interface BrainTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    config: BrainConfig;
}

// ─── 1. Conservative Operator ─────────────────────────

const conservativeOperator: BrainTemplate = {
    id: 'tpl_conservative_operator',
    name: 'Conservative Operator',
    description: 'Cautious, evidence-first approach. Minimizes risk, avoids speculation, and strictly follows documented information.',
    icon: 'shield',
    config: {
        ...DEFAULT_COMPANY_BRAIN_CONFIG,
        identity: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.identity,
            tonePreset: 'formal_corporate',
            formality: 9,
            warmth: 4,
            assertiveness: 5,
            creativity: 2,
            humor: 0,
            brandStrictness: 10,
            communicationStyle: 'structured',
        },
        reasoning: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.reasoning,
            depth: 8,
            speedVsThoroughness: 9,
            proactiveness: 3,
            challengeLevel: 2,
            analyticalStyle: 9,
            recommendationStrength: 5,
            askWhenUncertain: true,
            provideOptions: true,
            explainReasoning: true,
            bestEffortBias: 'clarification_first',
        },
        knowledge: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.knowledge,
            preferInternalSources: true,
            preferCuratedSources: true,
            sourceStrictness: 10,
            citationStrictness: 10,
            allowPartialAnswers: false,
            answerOnlyWhenGrounded: true,
            answerConfidenceThreshold: 0.75,
            escalationConfidenceThreshold: 0.5,
        },
        taskBehavior: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.taskBehavior,
            detailLevel: 7,
            actionOrientation: 4,
            persuasion: 1,
            educationalStyle: 6,
            verbosity: 'detailed',
        },
    },
};

// ─── 2. Trusted Advisor ───────────────────────────────

const trustedAdvisor: BrainTemplate = {
    id: 'tpl_trusted_advisor',
    name: 'Trusted Advisor',
    description: 'Balanced, consultative style. Provides thoughtful recommendations with context, challenges assumptions constructively.',
    icon: 'handshake',
    config: {
        ...DEFAULT_COMPANY_BRAIN_CONFIG,
        identity: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.identity,
            tonePreset: 'professional_consultative',
            formality: 7,
            warmth: 7,
            assertiveness: 7,
            creativity: 5,
            humor: 2,
            brandStrictness: 7,
            communicationStyle: 'consultative',
        },
        reasoning: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.reasoning,
            depth: 8,
            speedVsThoroughness: 7,
            proactiveness: 7,
            challengeLevel: 7,
            analyticalStyle: 7,
            recommendationStrength: 8,
            askWhenUncertain: true,
            provideOptions: true,
            explainReasoning: true,
            bestEffortBias: 'balanced',
        },
        knowledge: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.knowledge,
            sourceStrictness: 7,
            citationStrictness: 7,
            allowPartialAnswers: true,
        },
        taskBehavior: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.taskBehavior,
            detailLevel: 7,
            actionOrientation: 7,
            persuasion: 5,
            educationalStyle: 6,
            verbosity: 'medium',
        },
    },
};

// ─── 3. Premium Brand Voice ───────────────────────────

const premiumBrandVoice: BrainTemplate = {
    id: 'tpl_premium_brand_voice',
    name: 'Premium Brand Voice',
    description: 'Polished, brand-aligned communication. Uses sophisticated language and maintains consistent brand identity.',
    icon: 'sparkles',
    config: {
        ...DEFAULT_COMPANY_BRAIN_CONFIG,
        identity: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.identity,
            tonePreset: 'formal_corporate',
            formality: 8,
            warmth: 6,
            assertiveness: 7,
            creativity: 6,
            humor: 1,
            brandStrictness: 10,
            communicationStyle: 'executive',
        },
        reasoning: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.reasoning,
            depth: 7,
            speedVsThoroughness: 7,
            proactiveness: 6,
            challengeLevel: 4,
            recommendationStrength: 7,
            bestEffortBias: 'balanced',
        },
        taskBehavior: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.taskBehavior,
            detailLevel: 6,
            actionOrientation: 6,
            persuasion: 5,
            educationalStyle: 4,
            verbosity: 'medium',
            summaryStyle: 'narrative',
        },
    },
};

// ─── 4. Growth-Oriented Commercial ────────────────────

const growthOrientedCommercial: BrainTemplate = {
    id: 'tpl_growth_oriented',
    name: 'Growth-Oriented Commercial',
    description: 'Action-focused, commercially aware. Drives towards outcomes, provides strong recommendations, and favors speed.',
    icon: 'rocket',
    config: {
        ...DEFAULT_COMPANY_BRAIN_CONFIG,
        identity: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.identity,
            tonePreset: 'direct_efficient',
            formality: 6,
            warmth: 5,
            assertiveness: 9,
            creativity: 6,
            humor: 2,
            brandStrictness: 7,
            communicationStyle: 'concise',
        },
        reasoning: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.reasoning,
            depth: 6,
            speedVsThoroughness: 4,
            proactiveness: 9,
            challengeLevel: 5,
            analyticalStyle: 6,
            recommendationStrength: 9,
            askWhenUncertain: false,
            provideOptions: false,
            explainReasoning: false,
            bestEffortBias: 'best_effort',
        },
        taskBehavior: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.taskBehavior,
            detailLevel: 5,
            actionOrientation: 10,
            persuasion: 8,
            educationalStyle: 3,
            verbosity: 'brief',
            summaryStyle: 'bullet_points',
        },
    },
};

// ─── 5. Friendly Onboarding Guide ─────────────────────

const friendlyOnboardingGuide: BrainTemplate = {
    id: 'tpl_friendly_onboarding',
    name: 'Friendly Onboarding Guide',
    description: 'Welcoming, patient, and educational. Designed for new employees learning the ropes of a company.',
    icon: 'sprout',
    config: {
        ...DEFAULT_COMPANY_BRAIN_CONFIG,
        identity: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.identity,
            tonePreset: 'warm_supportive',
            formality: 3,
            warmth: 10,
            assertiveness: 3,
            creativity: 6,
            humor: 4,
            brandStrictness: 4,
            communicationStyle: 'educational',
        },
        reasoning: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.reasoning,
            depth: 6,
            speedVsThoroughness: 5,
            proactiveness: 8,
            challengeLevel: 1,
            analyticalStyle: 4,
            recommendationStrength: 5,
            askWhenUncertain: true,
            provideOptions: false,
            explainReasoning: true,
            bestEffortBias: 'best_effort',
        },
        taskBehavior: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.taskBehavior,
            detailLevel: 7,
            actionOrientation: 5,
            persuasion: 2,
            educationalStyle: 10,
            verbosity: 'medium',
        },
    },
};

// ─── 6. Evidence-First Expert ─────────────────────────

const evidenceFirstExpert: BrainTemplate = {
    id: 'tpl_evidence_first',
    name: 'Evidence-First Expert',
    description: 'Deep analytical expert. Relies heavily on documented evidence, provides thorough explanations with citations.',
    icon: 'microscope',
    config: {
        ...DEFAULT_COMPANY_BRAIN_CONFIG,
        identity: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.identity,
            tonePreset: 'authoritative_expert',
            formality: 8,
            warmth: 4,
            assertiveness: 8,
            creativity: 3,
            humor: 0,
            brandStrictness: 8,
            communicationStyle: 'structured',
        },
        reasoning: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.reasoning,
            depth: 10,
            speedVsThoroughness: 9,
            proactiveness: 5,
            challengeLevel: 8,
            analyticalStyle: 10,
            recommendationStrength: 8,
            askWhenUncertain: true,
            provideOptions: true,
            explainReasoning: true,
            bestEffortBias: 'clarification_first',
        },
        knowledge: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.knowledge,
            preferInternalSources: true,
            preferCuratedSources: true,
            sourceStrictness: 10,
            citationStrictness: 10,
            allowPartialAnswers: false,
            requireGroundingForSensitiveTopics: true,
            answerOnlyWhenGrounded: true,
            answerConfidenceThreshold: 0.7,
            escalationConfidenceThreshold: 0.45,
        },
        taskBehavior: {
            ...DEFAULT_COMPANY_BRAIN_CONFIG.taskBehavior,
            detailLevel: 9,
            actionOrientation: 5,
            persuasion: 3,
            educationalStyle: 8,
            verbosity: 'detailed',
            summaryStyle: 'structured',
        },
    },
};

// ─── Export All Templates ─────────────────────────────

export const BUILT_IN_TEMPLATES: BrainTemplate[] = [
    conservativeOperator,
    trustedAdvisor,
    premiumBrandVoice,
    growthOrientedCommercial,
    friendlyOnboardingGuide,
    evidenceFirstExpert,
];

export function getTemplateById(id: string): BrainTemplate | undefined {
    return BUILT_IN_TEMPLATES.find(t => t.id === id);
}
