/**
 * Navigation adapter.
 * Returns a deep link for client-side navigation.
 */
import type { ModuleAdapter, AdapterResult } from './types';

const ROUTE_MAP: Record<string, string> = {
    today: '/today',
    dashboard: '/today',
    team: '/team',
    projects: '/projects',
    deliverables: '/deliverables',
    knowledge: '/knowledge',
    customers: '/customers',
    boardroom: '/boardroom',
    tasks: '/tasks',
    settings: '/settings',
    profile: '/settings/profile',
    integrations: '/settings/integrations',
    ai_brain: '/settings/ai-brain',
    ai_team: '/settings/ai-brain',
};

export const navigationAdapter: ModuleAdapter = {
    name: 'navigation',
    requiredParams: ['target'],
    optionalParams: [],

    async execute(params: Record<string, unknown>): Promise<AdapterResult> {
        const target = String(params.target || '').toLowerCase().replace(/\s+/g, '_');
        const route = ROUTE_MAP[target];

        if (route) {
            return {
                success: true,
                resultSummary: `Navigating to ${target.replace(/_/g, ' ')}.`,
                deepLink: route,
            };
        }

        // Try to match partial
        const match = Object.entries(ROUTE_MAP).find(([key]) => key.includes(target) || target.includes(key));
        if (match) {
            return {
                success: true,
                resultSummary: `Navigating to ${match[0].replace(/_/g, ' ')}.`,
                deepLink: match[1],
            };
        }

        return { success: false, resultSummary: `Could not find a page matching "${target}".`, error: 'Unknown target' };
    },
};
