// ═══════════════════════════════════════════════════════
// AI BRAINS — Personality Trait ↔ Slider Mapper
// ═══════════════════════════════════════════════════════

import type { BrainIdentityConfig } from './schema';
import { TRAIT_SLIDER_MAP } from './schema';

// Slider keys that traits can control
const SLIDER_KEYS = ['formality', 'warmth', 'assertiveness', 'creativity', 'humor', 'brandStrictness'] as const;
type SliderKey = (typeof SLIDER_KEYS)[number];

/**
 * Merge selected personality traits into identity slider values.
 * When multiple traits overlap on the same slider, values are averaged.
 */
export function traitsToSliders(traits: string[]): Partial<Pick<BrainIdentityConfig, SliderKey>> {
    if (!traits.length) return {};

    const sums: Partial<Record<SliderKey, number>> = {};
    const counts: Partial<Record<SliderKey, number>> = {};

    for (const trait of traits) {
        const overrides = TRAIT_SLIDER_MAP[trait];
        if (!overrides) continue;
        for (const key of SLIDER_KEYS) {
            const val = (overrides as Record<string, number>)[key];
            if (val !== undefined) {
                sums[key] = (sums[key] || 0) + val;
                counts[key] = (counts[key] || 0) + 1;
            }
        }
    }

    const result: Partial<Pick<BrainIdentityConfig, SliderKey>> = {};
    for (const key of SLIDER_KEYS) {
        if (sums[key] !== undefined && counts[key]) {
            result[key] = Math.round(sums[key]! / counts[key]!);
        }
    }

    return result;
}

/**
 * Reverse-map slider values to the closest matching personality traits.
 * Used when loading an existing config to show which traits are "active".
 * A trait is considered active if all its slider values are within ±2 of the config.
 */
export function slidersToTraits(config: BrainIdentityConfig): string[] {
    const matched: string[] = [];

    for (const [trait, overrides] of Object.entries(TRAIT_SLIDER_MAP)) {
        let isMatch = true;
        for (const [key, targetVal] of Object.entries(overrides)) {
            const currentVal = (config as unknown as Record<string, number>)[key];
            if (currentVal === undefined || Math.abs(currentVal - (targetVal as number)) > 2) {
                isMatch = false;
                break;
            }
        }
        if (isMatch) matched.push(trait);
    }

    // If more than 5 traits match (too broad), return the config's own traits field
    if (matched.length > 5 && config.personalityTraits?.length) {
        return config.personalityTraits;
    }

    return matched;
}
