/**
 * Initiative Creation Adapter — creates a shell initiative in the Boardroom.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { ModuleAdapter, AuthContext, AdapterResult } from './types';

export const initiativeAdapter: ModuleAdapter = {
    name: 'initiative',
    requiredParams: ['name'],
    optionalParams: ['description', 'projectId'],

    async execute(params: Record<string, unknown>, auth: AuthContext): Promise<AdapterResult> {
        const name = String(params.name || '').trim();
        if (!name) {
            return { success: false, resultSummary: 'Initiative name is required.', error: 'MISSING_NAME' };
        }

        const description = String(params.description || '');
        const projectId = params.projectId ? String(params.projectId) : null;

        const db = createAdminClient();
        const id = crypto.randomUUID();

        const { error } = await db.from('Initiative').insert({
            id,
            companyId: auth.companyId,
            createdByUserId: auth.userId,
            name,
            description: description || null,
            projectId,
            status: 'IDEATION',
            priority: 'MEDIUM',
        });

        if (error) {
            console.error('[initiative-adapter] Insert failed:', error);
            return { success: false, resultSummary: 'Failed to create initiative.', error: error.message };
        }

        return {
            success: true,
            resultSummary: `Created initiative **"${name}"** in the Boardroom.`,
            deepLink: `/boardroom/${id}`,
            generatedId: id,
        };
    },
};
