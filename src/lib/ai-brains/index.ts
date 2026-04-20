// ═══════════════════════════════════════════════════════
// AI BRAINS — Barrel Export
// ═══════════════════════════════════════════════════════

export * from './schema';
export * from './defaults';
export { BUILT_IN_TEMPLATES, getTemplateById } from './templates';
export type { BrainTemplate } from './templates';
export { resolveEffectiveBrainConfig, invalidateBrainCache } from './resolve-effective-brain';
export { buildBrainSystemPrompt, getBrainTemperature } from './build-brain-prompt';
export type { BuildPromptInput } from './build-brain-prompt';
export { resolveRetrievalParams, DEFAULT_RETRIEVAL_PARAMS } from './brain-runtime-adapter';
export type { RetrievalParams } from './brain-runtime-adapter';
