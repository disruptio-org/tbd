/**
 * Handoff Adapter — routes requests to AI team members by brainType.
 * Resolves the correct AIBrainProfile and builds a deep link with prefilled prompt.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { ModuleAdapter, AuthContext, AdapterResult } from './types';

// Deterministic mapping from intent → brainType
const BRAIN_TYPE_MAP: Record<string, string> = {
    route_to_marketing: 'MARKETING',
    route_to_product:   'PRODUCT_ASSISTANT',
    route_to_sales:     'SALES',
    route_to_knowledge: 'COMPANY',
};

// Friendly labels for response messages
const BRAIN_LABELS: Record<string, string> = {
    MARKETING:          'Marketing Lead',
    PRODUCT_ASSISTANT:  'Product Lead',
    SALES:              'Sales Lead',
    COMPANY:            'Company Knowledge',
};

export interface HandoffResult extends AdapterResult {
    handoffMemberId?: string;
    handoffMemberName?: string;
    handoffBrainType?: string;
    prefilledPrompt?: string;
}

export const handoffAdapter: ModuleAdapter = {
    name: 'handoff',
    requiredParams: ['intentType', 'prefilledPrompt'],
    optionalParams: ['projectId'],

    async execute(params: Record<string, unknown>, auth: AuthContext): Promise<HandoffResult> {
        const intentType = String(params.intentType || '');
        const brainType = BRAIN_TYPE_MAP[intentType];
        const prefilledPrompt = String(params.prefilledPrompt || params.query || '');

        if (!brainType) {
            return {
                success: false,
                resultSummary: `Unknown handoff intent: ${intentType}`,
                error: 'UNKNOWN_HANDOFF_TARGET',
            };
        }

        const db = createAdminClient();

        // Find the team member by brainType for this company
        const { data: member } = await db
            .from('AIBrainProfile')
            .select('id, name, brainType')
            .eq('companyId', auth.companyId)
            .eq('brainType', brainType)
            .eq('status', 'ACTIVE')
            .maybeSingle();

        if (!member) {
            const label = BRAIN_LABELS[brainType] || brainType;
            return {
                success: false,
                resultSummary: `No ${label} is configured on your team. You can create one in AI Team Config.`,
                deepLink: '/settings/ai-brain',
                error: 'MEMBER_NOT_CONFIGURED',
            };
        }

        // Build deep link with prefilled prompt + project scope
        const queryParams = new URLSearchParams();
        queryParams.set('prompt', prefilledPrompt);
        if (params.projectId) queryParams.set('projectId', String(params.projectId));

        const deepLink = `/team?member=${member.id}&${queryParams.toString()}`;

        return {
            success: true,
            resultSummary: `Routed to **${member.name}**. I've prepared the context for them.`,
            deepLink,
            handoffMemberId: member.id,
            handoffMemberName: member.name,
            handoffBrainType: brainType,
            prefilledPrompt,
        };
    },
};
