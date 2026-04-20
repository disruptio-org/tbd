// ═══════════════════════════════════════════════════════
// AI BRAINS — Config Schema & Types
// ═══════════════════════════════════════════════════════

// ─── Brain Type Enum ──────────────────────────────────

export const BRAIN_TYPES = [
    'COMPANY',
    'COMPANY_ADVISOR',
    'SALES',
    'MARKETING',
    'ONBOARDING',
    'LEAD_DISCOVERY',
    'PRODUCT_ASSISTANT',
] as const;

export type BrainType = (typeof BRAIN_TYPES)[number];

export const ROLE_BRAIN_TYPES = BRAIN_TYPES.filter(t => t !== 'COMPANY') as Exclude<BrainType, 'COMPANY'>[];

// ─── Brain Status ─────────────────────────────────────

export type BrainStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type VersionStatus = 'DRAFT' | 'ACTIVE' | 'ROLLED_BACK';

// ─── Communication Style ──────────────────────────────

export const COMMUNICATION_STYLES = [
    'structured',
    'conversational',
    'concise',
    'consultative',
    'executive',
    'educational',
] as const;

export type CommunicationStyle = (typeof COMMUNICATION_STYLES)[number];

// ─── Tone Presets ─────────────────────────────────────

export const TONE_PRESETS = [
    'professional_consultative',
    'friendly_approachable',
    'formal_corporate',
    'warm_supportive',
    'direct_efficient',
    'creative_expressive',
    'authoritative_expert',
] as const;

export type TonePreset = (typeof TONE_PRESETS)[number];

// ─── Verbosity / Summary Enums ────────────────────────

export type VerbosityTarget = 'brief' | 'medium' | 'detailed';
export type SummaryStyle = 'structured' | 'narrative' | 'bullet_points';
export type BestEffortBias = 'best_effort' | 'clarification_first' | 'balanced';

// ─── Config Domain: Identity ──────────────────────────

export interface BrainIdentityConfig {
    tonePreset: TonePreset;
    formality: number;           // 0–10
    warmth: number;              // 0–10
    assertiveness: number;       // 0–10
    creativity: number;          // 0–10
    humor: number;               // 0–10
    brandStrictness: number;     // 0–10
    communicationStyle: CommunicationStyle;
    languagePreference: string;  // 'auto' | locale code
    personalityTraits: string[]; // Selected trait chips
}

// ─── Config Domain: Reasoning ─────────────────────────

export interface BrainReasoningConfig {
    depth: number;                    // 0–10
    speedVsThoroughness: number;      // 0–10
    proactiveness: number;            // 0–10
    challengeLevel: number;           // 0–10
    analyticalStyle: number;          // 0–10
    recommendationStrength: number;   // 0–10
    askWhenUncertain: boolean;
    provideOptions: boolean;
    explainReasoning: boolean;
    useStructuredResponses: boolean;
    bestEffortBias: BestEffortBias;
}

// ─── Config Domain: Knowledge ─────────────────────────

export interface BrainKnowledgeConfig {
    preferInternalSources: boolean;
    preferCuratedSources: boolean;
    useCompanyProfile: boolean;
    recencySensitivity: number;       // 0–10
    sourceStrictness: number;         // 0–10
    citationStrictness: number;       // 0–10
    allowPartialAnswers: boolean;
    requireGroundingForSensitiveTopics: boolean;
    answerOnlyWhenGrounded: boolean;
    useExternalSearchWhenWeak: boolean;
    answerConfidenceThreshold: number;     // 0–1
    escalationConfidenceThreshold: number; // 0–1
}

// ─── Config Domain: Task Behavior ─────────────────────

export interface BrainTaskBehaviorConfig {
    detailLevel: number;          // 0–10
    actionOrientation: number;    // 0–10
    persuasion: number;           // 0–10
    educationalStyle: number;     // 0–10
    verbosity: VerbosityTarget;
    summaryStyle: SummaryStyle;
}

// ─── Config Domain: Guardrails ────────────────────────

export interface BrainGuardrailsConfig {
    avoidInventingData: boolean;
    flagUncertainty: boolean;
    avoidLegalAdvice: boolean;
    avoidFinancialAdvice: boolean;
    avoidHrSensitiveAssumptions: boolean;
    avoidPricingCommitments: boolean;
    avoidContractualCommitments: boolean;
    sensitiveTopics: string[];
    requireHighConfidenceForPolicyAnswers: boolean;
    escalationInstruction: string;
    blockedBehaviors: string[];
    restrictedClaims: string[];
}

// ─── Config Domain: Delegation ────────────────────────

export interface BrainDelegationConfig {
    ownedTopics: string[];
    deferTopics: string[];
    allowDelegation: boolean;
}

// ─── Full Brain Config ────────────────────────────────

export interface BrainConfig {
    identity: BrainIdentityConfig;
    reasoning: BrainReasoningConfig;
    knowledge: BrainKnowledgeConfig;
    taskBehavior: BrainTaskBehaviorConfig;
    guardrails: BrainGuardrailsConfig;
    delegation: BrainDelegationConfig;
}

// ─── Advanced Instructions ────────────────────────────

export interface BrainAdvancedInstructions {
    additionalSystemInstructions: string;
    forbiddenPhrasing: string;
    preferredTerminology: string;
    outputExamples: string;
    roleSpecificNotes: string;
}

// ─── Brain Profile (DB row shape) ─────────────────────

export interface AIBrainProfileRow {
    id: string;
    companyId: string;
    brainType: BrainType;
    name: string;
    description: string | null;
    parentBrainId: string | null;
    status: BrainStatus;
    isEnabled: boolean;
    configJson: BrainConfig;
    advancedInstructions: BrainAdvancedInstructions | null;
    createdById: string;
    updatedById: string;
    createdAt: string;
    updatedAt: string;
}

// ─── Effective Config (resolved at runtime) ───────────

export interface EffectiveBrainConfig {
    config: BrainConfig;
    advancedInstructions: BrainAdvancedInstructions | null;
    companyBrainId: string | null;
    companyBrainVersionId: string | null;
    roleBrainId: string | null;
    roleBrainVersionId: string | null;
    isDefault: boolean; // true if no brain configured, using hardcoded defaults
}

// ─── Slider Field Metadata (for UI) ───────────────────

export interface SliderFieldMeta {
    key: string;
    label: string;
    description: string;
    min: number;
    max: number;
    step: number;
    lowLabel: string;
    highLabel: string;
}

// ─── Config field metadata for UI rendering ───────────

export const IDENTITY_SLIDERS: SliderFieldMeta[] = [
    { key: 'formality', label: 'Formality', description: 'How formal or casual the AI should sound', min: 0, max: 10, step: 1, lowLabel: 'Casual', highLabel: 'Very Formal' },
    { key: 'warmth', label: 'Warmth & Empathy', description: 'How warm and empathetic the AI should be', min: 0, max: 10, step: 1, lowLabel: 'Neutral', highLabel: 'Very Warm' },
    { key: 'assertiveness', label: 'Assertiveness', description: 'How assertive and confident in recommendations', min: 0, max: 10, step: 1, lowLabel: 'Gentle', highLabel: 'Very Assertive' },
    { key: 'creativity', label: 'Creativity', description: 'How creative and original in responses', min: 0, max: 10, step: 1, lowLabel: 'Conservative', highLabel: 'Very Creative' },
    { key: 'humor', label: 'Humor', description: 'How much humor to use in responses', min: 0, max: 10, step: 1, lowLabel: 'No Humor', highLabel: 'Playful' },
    { key: 'brandStrictness', label: 'Brand Strictness', description: 'How strictly to follow brand voice guidelines', min: 0, max: 10, step: 1, lowLabel: 'Flexible', highLabel: 'Very Strict' },
];

export const REASONING_SLIDERS: SliderFieldMeta[] = [
    { key: 'depth', label: 'Reasoning Depth', description: 'How deep the analysis and reasoning should go', min: 0, max: 10, step: 1, lowLabel: 'Surface', highLabel: 'Very Deep' },
    { key: 'speedVsThoroughness', label: 'Speed vs Thoroughness', description: 'Balance between quick responses and thorough analysis', min: 0, max: 10, step: 1, lowLabel: 'Quick', highLabel: 'Thorough' },
    { key: 'proactiveness', label: 'Proactiveness', description: 'How proactive in offering suggestions and next steps', min: 0, max: 10, step: 1, lowLabel: 'Reactive', highLabel: 'Very Proactive' },
    { key: 'challengeLevel', label: 'Challenge Level', description: 'How much the AI should challenge assumptions', min: 0, max: 10, step: 1, lowLabel: 'Agreeable', highLabel: 'Challenging' },
    { key: 'analyticalStyle', label: 'Analytical Style', description: 'Balance between analytical and intuitive approach', min: 0, max: 10, step: 1, lowLabel: 'Intuitive', highLabel: 'Analytical' },
    { key: 'recommendationStrength', label: 'Recommendation Strength', description: 'How strong and decisive recommendations should be', min: 0, max: 10, step: 1, lowLabel: 'Soft Suggestions', highLabel: 'Strong Recommendations' },
];

export const KNOWLEDGE_SLIDERS: SliderFieldMeta[] = [
    { key: 'recencySensitivity', label: 'Recency Sensitivity', description: 'How much to favor recent documents over older ones', min: 0, max: 10, step: 1, lowLabel: 'Age-neutral', highLabel: 'Favor Recent' },
    { key: 'sourceStrictness', label: 'Source Strictness', description: 'How strictly to rely on provided sources', min: 0, max: 10, step: 1, lowLabel: 'Flexible', highLabel: 'Very Strict' },
    { key: 'citationStrictness', label: 'Citation Strictness', description: 'How often to cite sources in responses', min: 0, max: 10, step: 1, lowLabel: 'Rarely Cite', highLabel: 'Always Cite' },
];

export const TASK_BEHAVIOR_SLIDERS: SliderFieldMeta[] = [
    { key: 'detailLevel', label: 'Detail Level', description: 'How detailed responses should be', min: 0, max: 10, step: 1, lowLabel: 'High-level', highLabel: 'Very Detailed' },
    { key: 'actionOrientation', label: 'Action Orientation', description: 'How much to focus on actionable next steps', min: 0, max: 10, step: 1, lowLabel: 'Informational', highLabel: 'Action-focused' },
    { key: 'persuasion', label: 'Persuasion', description: 'How persuasive the AI should be', min: 0, max: 10, step: 1, lowLabel: 'Neutral', highLabel: 'Persuasive' },
    { key: 'educationalStyle', label: 'Educational Style', description: 'How educational and explanatory', min: 0, max: 10, step: 1, lowLabel: 'Direct Answer', highLabel: 'Full Explanation' },
];

// ─── Personality Trait System ──────────────────────────

export const PERSONALITY_TRAIT_OPTIONS = [
    'Creative',
    'Formal',
    'Warm',
    'Direct',
    'Analytical',
    'Playful',
    'Conservative',
    'Bold',
    'Educational',
    'Empathetic',
] as const;

export type PersonalityTrait = (typeof PERSONALITY_TRAIT_OPTIONS)[number];

/** Maps each personality trait to the slider overrides it implies */
export const TRAIT_SLIDER_MAP: Record<string, Partial<Omit<BrainIdentityConfig, 'tonePreset' | 'communicationStyle' | 'languagePreference' | 'personalityTraits'>>> = {
    Creative:      { creativity: 8, humor: 4 },
    Formal:        { formality: 8, warmth: 3, humor: 1 },
    Warm:          { warmth: 8, formality: 4, humor: 3 },
    Direct:        { assertiveness: 8, formality: 6, warmth: 4 },
    Analytical:    { creativity: 3, humor: 1 },
    Playful:       { humor: 7, creativity: 7, warmth: 7, formality: 2 },
    Conservative:  { brandStrictness: 8, creativity: 3, formality: 7 },
    Bold:          { assertiveness: 9, creativity: 6, humor: 2 },
    Educational:   { warmth: 6, formality: 5, creativity: 4 },
    Empathetic:    { warmth: 9, assertiveness: 3, formality: 3 },
};

// ─── Validation helpers ───────────────────────────────

export function clampSlider(value: number): number {
    return Math.max(0, Math.min(10, Math.round(value)));
}

export function clampThreshold(value: number): number {
    return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export function validateBrainConfig(config: Partial<BrainConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.identity) {
        const id = config.identity;
        if (!TONE_PRESETS.includes(id.tonePreset as TonePreset)) errors.push('Invalid tone preset');
        if (!COMMUNICATION_STYLES.includes(id.communicationStyle as CommunicationStyle)) errors.push('Invalid communication style');
        for (const key of ['formality', 'warmth', 'assertiveness', 'creativity', 'humor', 'brandStrictness'] as const) {
            if (typeof id[key] !== 'number' || id[key] < 0 || id[key] > 10) errors.push(`identity.${key} must be 0–10`);
        }
    }

    if (config.reasoning) {
        const r = config.reasoning;
        for (const key of ['depth', 'speedVsThoroughness', 'proactiveness', 'challengeLevel', 'analyticalStyle', 'recommendationStrength'] as const) {
            if (typeof r[key] !== 'number' || r[key] < 0 || r[key] > 10) errors.push(`reasoning.${key} must be 0–10`);
        }
    }

    if (config.knowledge) {
        const k = config.knowledge;
        if (typeof k.answerConfidenceThreshold === 'number' && (k.answerConfidenceThreshold < 0 || k.answerConfidenceThreshold > 1)) {
            errors.push('knowledge.answerConfidenceThreshold must be 0–1');
        }
        if (typeof k.escalationConfidenceThreshold === 'number' && (k.escalationConfidenceThreshold < 0 || k.escalationConfidenceThreshold > 1)) {
            errors.push('knowledge.escalationConfidenceThreshold must be 0–1');
        }
    }

    return { valid: errors.length === 0, errors };
}

// ─── Deep merge for brain config inheritance ──────────

export function deepMergeBrainConfig(parent: BrainConfig, childOverrides: Partial<BrainConfig>): BrainConfig {
    const merged: BrainConfig = JSON.parse(JSON.stringify(parent));

    if (childOverrides.identity) {
        merged.identity = { ...merged.identity, ...childOverrides.identity };
    }
    if (childOverrides.reasoning) {
        merged.reasoning = { ...merged.reasoning, ...childOverrides.reasoning };
    }
    if (childOverrides.knowledge) {
        merged.knowledge = { ...merged.knowledge, ...childOverrides.knowledge };
    }
    if (childOverrides.taskBehavior) {
        merged.taskBehavior = { ...merged.taskBehavior, ...childOverrides.taskBehavior };
    }
    if (childOverrides.guardrails) {
        // For arrays, replace entirely (not merge)
        merged.guardrails = { ...merged.guardrails, ...childOverrides.guardrails };
    }
    if (childOverrides.delegation) {
        merged.delegation = { ...merged.delegation, ...childOverrides.delegation };
    }

    return merged;
}

// ─── Merge advanced instructions ──────────────────────

export function mergeAdvancedInstructions(
    parent: BrainAdvancedInstructions | null,
    child: BrainAdvancedInstructions | null,
): BrainAdvancedInstructions {
    const empty: BrainAdvancedInstructions = {
        additionalSystemInstructions: '',
        forbiddenPhrasing: '',
        preferredTerminology: '',
        outputExamples: '',
        roleSpecificNotes: '',
    };

    if (!parent && !child) return empty;
    if (!child) return parent || empty;
    if (!parent) return child;

    // Child values win for non-empty fields; otherwise inherit parent
    return {
        additionalSystemInstructions: child.additionalSystemInstructions || parent.additionalSystemInstructions,
        forbiddenPhrasing: child.forbiddenPhrasing || parent.forbiddenPhrasing,
        preferredTerminology: child.preferredTerminology || parent.preferredTerminology,
        outputExamples: child.outputExamples || parent.outputExamples,
        roleSpecificNotes: child.roleSpecificNotes || parent.roleSpecificNotes,
    };
}
