// ═══════════════════════════════════════════════════════
// AI BRAINS — Team Designer Types & Constants
// ═══════════════════════════════════════════════════════

import type { BrainConfig, BrainAdvancedInstructions } from './schema';

// ─── Team Design Request ──────────────────────────────

export type TeamGoal = 'growth' | 'product' | 'operations' | 'brand' | 'general';
export type TeamSize = 'lean' | 'standard' | 'advanced';

export interface TeamDesignRequest {
    goal: TeamGoal;
    teamSize: TeamSize;
    userIntent?: string;
}

// ─── Team Design Output ───────────────────────────────

export interface TeamMemberProposal {
    brainType: string;
    name: string;
    description: string;
    mission: string;
    responsibilities: string[];
    personalityTraits: string[];
    configJson: BrainConfig;
    advancedInstructions: BrainAdvancedInstructions;
    collaborationRules: string[];
}

export interface TeamDesignResult {
    summary: string;
    collaboration: string;
    members: TeamMemberProposal[];
}

// ─── Constants ────────────────────────────────────────

export const TEAM_SIZE_RANGES: Record<TeamSize, { min: number; max: number; label: string }> = {
    lean: { min: 3, max: 4, label: 'Lean (3–4 members)' },
    standard: { min: 4, max: 6, label: 'Standard (4–6 members)' },
    advanced: { min: 6, max: 8, label: 'Advanced (6–8 members)' },
};

export const TEAM_GOAL_OPTIONS: { key: TeamGoal; label: string; description: string; icon: string }[] = [
    { key: 'growth', label: 'Growth', description: 'Revenue, sales, and market expansion', icon: 'rocket' },
    { key: 'product', label: 'Product', description: 'Product strategy, specs, and delivery', icon: 'package' },
    { key: 'operations', label: 'Operations', description: 'Processes, efficiency, and internal ops', icon: 'settings' },
    { key: 'brand', label: 'Brand', description: 'Brand voice, content, and communication', icon: 'sparkles' },
    { key: 'general', label: 'General', description: 'Balanced team across all areas', icon: 'brain' },
];

// ─── Profile Completion Thresholds ────────────────────

export const PROFILE_MIN_THRESHOLD = 40;   // soft-block below this
export const PROFILE_WARN_THRESHOLD = 70;  // show improvement hint below this
