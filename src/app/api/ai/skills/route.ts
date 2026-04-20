// ═══════════════════════════════════════════════════════
// API: /api/ai/skills — CRUD for Assistant Skills
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// ─── GET: List skills for current company ─────────────
// Query params: ?assistantType=MARKETING (optional filter via SkillAssignment)

export async function GET(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const assistantType = searchParams.get('assistantType');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    try {
        const db = createAdminClient();

        if (assistantType) {
            // Filter: get skills assigned to this assistantType via join
            const { data: assignments, error: aErr } = await db
                .from('SkillAssignment')
                .select('skillId')
                .eq('assistantType', assistantType);
            if (aErr) throw aErr;

            const skillIds = (assignments || []).map(a => a.skillId);
            if (skillIds.length === 0) {
                return NextResponse.json({ skills: [] });
            }

            let query = db
                .from('AssistantSkill')
                .select('*, SkillAssignment(assistantType)')
                .eq('companyId', auth.dbUser.companyId)
                .in('id', skillIds);
            if (!includeArchived) query = query.neq('status', 'ARCHIVED');
            const { data: skills, error } = await query
                .order('sortOrder', { ascending: true })
                .order('name', { ascending: true });
            if (error) throw error;

            // Flatten assignments into assistantTypes array
            const mapped = (skills || []).map(s => {
                const { SkillAssignment: sa, ...rest } = s;
                return { ...rest, assistantTypes: (sa || []).map((a: { assistantType: string }) => a.assistantType) };
            });

            return NextResponse.json({ skills: mapped });
        } else {
            // No filter: return all skills with their assignments
            let query = db
                .from('AssistantSkill')
                .select('*, SkillAssignment(assistantType)')
                .eq('companyId', auth.dbUser.companyId);
            if (!includeArchived) query = query.neq('status', 'ARCHIVED');
            const { data: skills, error } = await query
                .order('sortOrder', { ascending: true })
                .order('name', { ascending: true });
            if (error) throw error;

            const mapped = (skills || []).map(s => {
                const { SkillAssignment: sa, ...rest } = s;
                return { ...rest, assistantTypes: (sa || []).map((a: { assistantType: string }) => a.assistantType) };
            });

            return NextResponse.json({ skills: mapped });
        }
    } catch (error) {
        console.error('[api/ai/skills] GET error:', error);
        return NextResponse.json({ error: 'Failed to load skills' }, { status: 500 });
    }
}

// ─── POST: Create a new custom skill (admin only) ─────

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.dbUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    try {
        const body = await request.json();
        const {
            assistantType,    // backward compat: single type
            assistantTypes,   // new: array of types
            key, name, description, icon, category,
            instructionPrompt, outputSchema, requiredInputs, defaultParams,
            outputActions,
            responseMode,
            runtimeCategory,
        } = body;

        // Resolve into a types array
        const types: string[] = assistantTypes || (assistantType ? [assistantType] : []);

        if (!key || !name) {
            return NextResponse.json({ error: 'key and name are required' }, { status: 400 });
        }

        // Validate key format (lowercase alphanumeric + underscores)
        if (!/^[a-z0-9_]+$/.test(key)) {
            return NextResponse.json({ error: 'key must be lowercase alphanumeric with underscores only' }, { status: 400 });
        }

        const db = createAdminClient();
        const skillId = crypto.randomUUID();

        const { data: skill, error } = await db.from('AssistantSkill').insert({
            id: skillId,
            companyId: auth.dbUser.companyId,
            assistantType: types[0] || null, // backward compat
            key,
            name,
            description: description || null,
            icon: icon || null,
            category: category || null,
            instructionPrompt: instructionPrompt || null,
            outputSchema: outputSchema || null,
            requiredInputs: requiredInputs || null,
            defaultParams: defaultParams || null,
            outputActions: outputActions || ['preview', 'copy', 'regenerate'],
            isDefault: false,
            status: 'ACTIVE',
            sortOrder: 99,
            version: 1,
            importMode: 'LEGACY',
            runtimeCategory: runtimeCategory || 'content-generation',
            responseMode: responseMode || 'chat',
            compatibilityState: 'FULLY_COMPATIBLE',
            updatedAt: new Date().toISOString(),
        }).select().single();

        if (error) {
            if (error.message?.includes('unique') || error.code === '23505') {
                return NextResponse.json({ error: 'A skill with this key already exists' }, { status: 409 });
            }
            throw error;
        }

        // Create SkillAssignment rows
        if (types.length > 0) {
            const assignments = types.map(t => ({
                id: crypto.randomUUID(),
                skillId,
                assistantType: t,
            }));
            const { error: aErr } = await db.from('SkillAssignment').insert(assignments);
            if (aErr) console.error('[api/ai/skills] Failed to create assignments:', aErr);
        }

        return NextResponse.json({ skill: { ...skill, assistantTypes: types } }, { status: 201 });
    } catch (error) {
        console.error('[api/ai/skills] POST error:', error);
        return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
    }
}
