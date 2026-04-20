// ═══════════════════════════════════════════════════════
// POST /api/ai/brains/create-team
// Persists an approved AI team design into brain profiles
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDefaultBrainConfig } from '@/lib/ai-brains/defaults';
import { validateBrainConfig } from '@/lib/ai-brains/schema';
import type { TeamMemberProposal } from '@/lib/ai-brains/team-designer';

interface CreateTeamBody {
    members: TeamMemberProposal[];
    autoPublish?: boolean;
}

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId, role').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json() as CreateTeamBody;
        const { members, autoPublish } = body;

        if (!members || !Array.isArray(members) || members.length === 0) {
            return NextResponse.json({ error: 'No members to create' }, { status: 400 });
        }

        // ── 1. Ensure Company Brain exists ──
        let { data: companyBrain } = await db
            .from('AIBrainProfile')
            .select('id')
            .eq('companyId', dbUser.companyId)
            .eq('brainType', 'COMPANY')
            .maybeSingle();

        if (!companyBrain) {
            const defaultConfig = getDefaultBrainConfig('COMPANY');
            const { data: created, error: createErr } = await db
                .from('AIBrainProfile')
                .insert({
                    id: crypto.randomUUID(),
                    companyId: dbUser.companyId,
                    brainType: 'COMPANY',
                    name: 'Company DNA',
                    description: 'Shared culture, tone, and guardrails inherited by all team members',
                    parentBrainId: null,
                    status: 'DRAFT',
                    isEnabled: true,
                    configJson: defaultConfig,
                    advancedInstructions: null,
                    createdById: dbUser.id,
                    updatedById: dbUser.id,
                    updatedAt: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (createErr) {
                console.error('[create-team] Failed to create Company Brain:', createErr);
                return NextResponse.json({ error: 'Failed to create Company DNA' }, { status: 500 });
            }
            companyBrain = created;
        }

        // ── 2. Load existing brains to skip duplicates ──
        const { data: existingBrains } = await db
            .from('AIBrainProfile')
            .select('brainType')
            .eq('companyId', dbUser.companyId);

        const existingTypes = new Set((existingBrains || []).map(b => b.brainType));

        // ── 3. Create each member ──
        const created: string[] = [];
        const skipped: string[] = [];
        const errors: string[] = [];

        for (const member of members) {
            // Skip if brain type already exists
            if (existingTypes.has(member.brainType)) {
                skipped.push(member.name);
                continue;
            }

            // Validate config
            const validation = validateBrainConfig(member.configJson);
            if (!validation.valid) {
                console.warn(`[create-team] Skipping ${member.name} due to invalid config:`, validation.errors);
                errors.push(`${member.name}: invalid configuration`);
                continue;
            }

            // Create the brain profile
            const brainId = crypto.randomUUID();
            const { error: insertErr } = await db
                .from('AIBrainProfile')
                .insert({
                    id: brainId,
                    companyId: dbUser.companyId,
                    brainType: member.brainType,
                    name: member.name,
                    description: member.description || null,
                    parentBrainId: companyBrain!.id,
                    status: autoPublish ? 'ACTIVE' : 'DRAFT',
                    isEnabled: true,
                    configJson: member.configJson,
                    advancedInstructions: member.advancedInstructions || null,
                    createdById: dbUser.id,
                    updatedById: dbUser.id,
                    updatedAt: new Date().toISOString(),
                });

            if (insertErr) {
                console.error(`[create-team] Failed to create ${member.name}:`, insertErr);
                errors.push(`${member.name}: creation failed`);
                continue;
            }

            // If auto-publish, create a version snapshot for audit trail
            if (autoPublish) {
                const { error: versionErr } = await db.from('AIBrainVersion').insert({
                    id: crypto.randomUUID(),
                    brainId,
                    version: 1,
                    configSnapshot: member.configJson,
                    changeSummary: 'Auto-published by AI Team Designer',
                    publishedById: dbUser.id,
                });
                if (versionErr) console.warn(`[create-team] Version snapshot failed for ${member.name}:`, versionErr);
            }

            existingTypes.add(member.brainType);
            created.push(member.name);
        }

        return NextResponse.json({
            created,
            skipped,
            errors,
            totalCreated: created.length,
            totalSkipped: skipped.length,
            totalErrors: errors.length,
        });
    } catch (error) {
        console.error('[create-team] error:', error);
        return NextResponse.json({ error: 'Team creation failed' }, { status: 500 });
    }
}
