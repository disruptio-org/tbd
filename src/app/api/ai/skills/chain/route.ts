// ═══════════════════════════════════════════════════════
// API: /api/ai/skills/chain — Execute a skill chain
// ═══════════════════════════════════════════════════════
//
// POST { skillKey, topic, language? }
//
// If the skill has a `chain` in defaultParams, runs the multi-step workflow.
// Otherwise returns an error.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { loadChainDefinition, executeChain } from '@/lib/community-skills/chain-executor';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { skillKey, topic, language = 'pt-PT' } = body;

        if (!skillKey || !topic) {
            return NextResponse.json({ error: 'skillKey and topic are required' }, { status: 400 });
        }

        // Load chain definition
        const chain = await loadChainDefinition(auth.dbUser.companyId, skillKey);
        if (!chain) {
            return NextResponse.json({
                error: `Skill "${skillKey}" does not have a chain configuration. Add a "chain" array to its defaultParams.`,
            }, { status: 400 });
        }

        // Load company profile for context
        const db = createAdminClient();
        const { data: profile } = await db.from('CompanyProfile')
            .select('companyName, productsServices, targetCustomers, strategicGoals')
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        const companyProfile = profile
            ? `Company: ${profile.companyName || 'Unknown'}\nProducts: ${profile.productsServices || 'N/A'}\nCustomers: ${profile.targetCustomers || 'N/A'}\nGoals: ${profile.strategicGoals || 'N/A'}`
            : undefined;

        // Execute chain
        const result = await executeChain(auth.dbUser.companyId, chain, topic, {
            userId: auth.dbUser.id,
            language,
            companyProfile,
        });

        return NextResponse.json(result, { status: result.status === 'failed' ? 500 : 200 });
    } catch (error) {
        console.error('[api/ai/skills/chain] Error:', error);
        return NextResponse.json({ error: 'Chain execution failed' }, { status: 500 });
    }
}
