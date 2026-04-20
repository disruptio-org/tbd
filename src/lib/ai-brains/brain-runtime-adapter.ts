// ═══════════════════════════════════════════════════════
// AI BRAINS — Runtime Retrieval Adapter
// ═══════════════════════════════════════════════════════
// Maps brain config → runtime retrieval parameters that
// adjust the scoring function, thresholds, and boosts.

import type { BrainConfig } from './schema';

// ─── Retrieval Parameters ─────────────────────────────

export interface RetrievalParams {
    /** Boost added to curated/knowledge-source documents */
    curatedSourceBoost: number;
    /** Boost added to documents matching intent category */
    categoryBoost: number;
    /** Boost added to critical-priority documents */
    criticalPriorityBoost: number;
    /** Boost added to preferred-priority documents */
    preferredPriorityBoost: number;
    /** Boost added to recently updated documents (within 30 days) */
    recencyBoost: number;
    /** Minimum similarity threshold to include a chunk */
    minSimilarityThreshold: number;
    /** Maximum total chunks to return */
    maxTotalChunks: number;
    /** Maximum chunks per document */
    maxChunksPerDoc: number;
    /** Threshold for VERIFIED grounding status */
    verifiedThreshold: number;
    /** Threshold for PARTIAL grounding status */
    partialThreshold: number;
}

// ─── Default Parameters (match current hardcoded values) ──

export const DEFAULT_RETRIEVAL_PARAMS: RetrievalParams = {
    curatedSourceBoost: 0.20,
    categoryBoost: 0.15,
    criticalPriorityBoost: 0.10,
    preferredPriorityBoost: 0.05,
    recencyBoost: 0.03,
    minSimilarityThreshold: 0.2,
    maxTotalChunks: 8,
    maxChunksPerDoc: 2,
    verifiedThreshold: 0.75,
    partialThreshold: 0.4,
};

// ─── Resolve retrieval params from brain config ───────

export function resolveRetrievalParams(config: BrainConfig): RetrievalParams {
    const params = { ...DEFAULT_RETRIEVAL_PARAMS };
    const k = config.knowledge;

    // ── Curated source boost ──
    // Slider preferCuratedSources (boolean) + sourceStrictness (0-10)
    if (k.preferCuratedSources) {
        // Scale curated boost by source strictness: 0.15 at base, up to 0.30 at max
        params.curatedSourceBoost = 0.15 + (k.sourceStrictness / 10) * 0.15;
    } else {
        params.curatedSourceBoost = 0.05; // minimal boost if not preferred
    }

    // ── Category boost ──
    // Keep stable; intent matching is always useful
    params.categoryBoost = 0.15;

    // ── Recency boost ──
    // Scale by recency sensitivity: 0 at 0, 0.08 at 10
    params.recencyBoost = (k.recencySensitivity / 10) * 0.08;

    // ── Similarity threshold ──
    // Higher source strictness → higher threshold
    // Range: 0.15 (lax) to 0.35 (strict)
    params.minSimilarityThreshold = 0.15 + (k.sourceStrictness / 10) * 0.20;

    // ── Grounding thresholds ──
    if (k.answerOnlyWhenGrounded) {
        // Strict: require higher scores for VERIFIED
        params.verifiedThreshold = 0.80;
        params.partialThreshold = 0.50;
    } else if (k.requireGroundingForSensitiveTopics) {
        params.verifiedThreshold = 0.75;
        params.partialThreshold = 0.40;
    } else {
        // Relaxed
        params.verifiedThreshold = 0.65;
        params.partialThreshold = 0.35;
    }

    // ── Confidence thresholds affect max chunks ──
    // Higher confidence requirements → more chunks to gather evidence
    if (k.answerConfidenceThreshold >= 0.7) {
        params.maxTotalChunks = 10;
    } else if (k.answerConfidenceThreshold <= 0.4) {
        params.maxTotalChunks = 6;
    }

    return params;
}
