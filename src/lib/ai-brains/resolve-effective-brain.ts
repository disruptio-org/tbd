// ═══════════════════════════════════════════════════════
// AI BRAINS — Effective Config Resolver
// ═══════════════════════════════════════════════════════
// Resolves the effective brain config at runtime by:
// 1. Loading the active Company Brain
// 2. Loading the active Role Brain (if exists for the assistant type)
// 3. Deep-merging parent config + child overrides
// 4. Returns effective config + version IDs

import { createAdminClient } from '@/lib/supabase/admin';
import type { BrainConfig, BrainAdvancedInstructions, EffectiveBrainConfig } from './schema';
import { deepMergeBrainConfig, mergeAdvancedInstructions } from './schema';
import { DEFAULT_COMPANY_BRAIN_CONFIG, DEFAULT_ADVANCED_INSTRUCTIONS, ASSISTANT_TYPE_TO_BRAIN_TYPE, getDefaultBrainConfig } from './defaults';
import type { BrainType } from './schema';

// ─── Cache ────────────────────────────────────────────

interface CacheEntry {
    result: EffectiveBrainConfig;
    timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCacheKey(companyId: string, assistantType: string): string {
    return `${companyId}:${assistantType}`;
}

export function invalidateBrainCache(companyId: string): void {
    for (const key of cache.keys()) {
        if (key.startsWith(companyId + ':')) {
            cache.delete(key);
        }
    }
}

// ─── Main Resolver ────────────────────────────────────

export async function resolveEffectiveBrainConfig(
    companyId: string,
    assistantType: string,
): Promise<EffectiveBrainConfig> {
    // Check cache
    const cacheKey = getCacheKey(companyId, assistantType);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.result;
    }

    const db = createAdminClient();

    // Map assistant type to brain type
    const roleBrainType: BrainType | undefined = ASSISTANT_TYPE_TO_BRAIN_TYPE[assistantType];

    // 1. Load active Company Brain
    const { data: companyBrain } = await db
        .from('AIBrainProfile')
        .select('id, configJson, advancedInstructions, status')
        .eq('companyId', companyId)
        .eq('brainType', 'COMPANY')
        .eq('status', 'ACTIVE')
        .maybeSingle();

    // If no Company Brain exists, return defaults
    if (!companyBrain) {
        const defaultConfig = roleBrainType
            ? getDefaultBrainConfig(roleBrainType)
            : DEFAULT_COMPANY_BRAIN_CONFIG;

        const result: EffectiveBrainConfig = {
            config: defaultConfig,
            advancedInstructions: DEFAULT_ADVANCED_INSTRUCTIONS,
            companyBrainId: null,
            companyBrainVersionId: null,
            roleBrainId: null,
            roleBrainVersionId: null,
            isDefault: true,
        };

        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    }

    // Get company brain's active version
    const { data: companyVersion } = await db
        .from('AIBrainVersion')
        .select('id')
        .eq('brainProfileId', companyBrain.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

    const companyConfig = companyBrain.configJson as unknown as BrainConfig;
    const companyAdvanced = companyBrain.advancedInstructions as unknown as BrainAdvancedInstructions | null;

    // 2. If there's a specific role brain type, try to load it
    if (roleBrainType && roleBrainType !== 'COMPANY') {
        const { data: roleBrain } = await db
            .from('AIBrainProfile')
            .select('id, configJson, advancedInstructions, isEnabled, status')
            .eq('companyId', companyId)
            .eq('brainType', roleBrainType)
            .eq('status', 'ACTIVE')
            .maybeSingle();

        if (roleBrain && roleBrain.isEnabled) {
            const roleConfig = roleBrain.configJson as unknown as BrainConfig;
            const roleAdvanced = roleBrain.advancedInstructions as unknown as BrainAdvancedInstructions | null;

            // Get role brain's active version
            const { data: roleVersion } = await db
                .from('AIBrainVersion')
                .select('id')
                .eq('brainProfileId', roleBrain.id)
                .eq('status', 'ACTIVE')
                .maybeSingle();

            // 3. Merge: company config + role overrides
            const effectiveConfig = deepMergeBrainConfig(companyConfig, roleConfig);
            const effectiveAdvanced = mergeAdvancedInstructions(companyAdvanced, roleAdvanced);

            const result: EffectiveBrainConfig = {
                config: effectiveConfig,
                advancedInstructions: effectiveAdvanced,
                companyBrainId: companyBrain.id,
                companyBrainVersionId: companyVersion?.id || null,
                roleBrainId: roleBrain.id,
                roleBrainVersionId: roleVersion?.id || null,
                isDefault: false,
            };

            cache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
        }
    }

    // No role brain (or disabled) — use Company Brain only
    const result: EffectiveBrainConfig = {
        config: companyConfig,
        advancedInstructions: companyAdvanced,
        companyBrainId: companyBrain.id,
        companyBrainVersionId: companyVersion?.id || null,
        roleBrainId: null,
        roleBrainVersionId: null,
        isDefault: false,
    };

    cache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
}
