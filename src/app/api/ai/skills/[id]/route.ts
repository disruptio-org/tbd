// ═══════════════════════════════════════════════════════
// API: /api/ai/skills/[id] — Single skill CRUD
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteContext { params: Promise<{ id: string }> }

// ─── GET: Get a single skill ──────────────────────────

export async function GET(_request: Request, context: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const db = createAdminClient();

    const { data: skill, error } = await db
        .from('AssistantSkill')
        .select('*, SkillAssignment(assistantType)')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (error) {
        console.error('[api/ai/skills/[id]] GET error:', error);
        return NextResponse.json({ error: 'Failed to load skill' }, { status: 500 });
    }
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });

    const { SkillAssignment: sa, ...rest } = skill;
    return NextResponse.json({ skill: { ...rest, assistantTypes: (sa || []).map((a: { assistantType: string }) => a.assistantType) } });
}

// ─── PATCH: Update a skill (admin only) ───────────────

export async function PATCH(request: Request, context: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.dbUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { id } = await context.params;
    const db = createAdminClient();

    // Verify ownership
    const { data: existing } = await db
        .from('AssistantSkill')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });

    try {
        const body = await request.json();
        const allowedFields = ['name', 'description', 'icon', 'category', 'status', 'sortOrder', 'instructionPrompt', 'outputSchema', 'requiredInputs', 'defaultParams', 'trainingMaterials', 'enabledActions', 'outputActions'];

        const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        for (const field of allowedFields) {
            if (field in body) data[field] = body[field];
        }

        // Increment version and snapshot old prompt if instructions change
        if ('instructionPrompt' in body && body.instructionPrompt !== existing.instructionPrompt) {
            data.version = existing.version + 1;

            // Snapshot the old version into SkillVersionLog
            await db.from('SkillVersionLog').insert({
                id: crypto.randomUUID(),
                skillId: existing.id,
                version: existing.version,
                instructionPrompt: existing.instructionPrompt || null,
                changedBy: auth.dbUser.id,
                changeSummary: body.changeSummary || `Updated to v${existing.version + 1}`,
                createdAt: new Date().toISOString(),
            });
        }

        const { data: skill, error } = await db
            .from('AssistantSkill')
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // ── Sync SkillAssignment if assistantTypes provided ──
        let assistantTypes: string[] | undefined;
        if ('assistantTypes' in body && Array.isArray(body.assistantTypes)) {
            const newTypes: string[] = body.assistantTypes;

            // Get current assignments
            const { data: currentAssignments } = await db
                .from('SkillAssignment')
                .select('id, assistantType')
                .eq('skillId', id);

            const currentTypes = (currentAssignments || []).map(a => a.assistantType);

            // Delete removed
            const toRemove = (currentAssignments || []).filter(a => !newTypes.includes(a.assistantType));
            if (toRemove.length > 0) {
                await db.from('SkillAssignment').delete().in('id', toRemove.map(a => a.id));
            }

            // Insert new
            const toAdd = newTypes.filter(t => !currentTypes.includes(t));
            if (toAdd.length > 0) {
                await db.from('SkillAssignment').insert(
                    toAdd.map(t => ({ id: crypto.randomUUID(), skillId: id, assistantType: t }))
                );
            }

            // Also update the deprecated assistantType field for backward compat
            if (newTypes.length > 0) {
                await db.from('AssistantSkill').update({ assistantType: newTypes[0] }).eq('id', id);
            }

            assistantTypes = newTypes;
        } else {
            // Fetch current for response
            const { data: sa } = await db.from('SkillAssignment').select('assistantType').eq('skillId', id);
            assistantTypes = (sa || []).map(a => a.assistantType);
        }

        return NextResponse.json({ skill: { ...skill, assistantTypes } });
    } catch (error) {
        console.error('[api/ai/skills/[id]] PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 });
    }
}

// ─── DELETE: Delete a custom skill (admin only) ───────

export async function DELETE(_request: Request, context: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.dbUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { id } = await context.params;
    const db = createAdminClient();

    const { data: existing } = await db
        .from('AssistantSkill')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });

    if (existing.isDefault) {
        // Don't delete system defaults — archive them instead
        const { error } = await db
            .from('AssistantSkill')
            .update({ status: 'ARCHIVED', updatedAt: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('[api/ai/skills/[id]] archive error:', error);
            return NextResponse.json({ error: 'Failed to archive skill' }, { status: 500 });
        }
        return NextResponse.json({ message: 'Default skill archived (cannot be deleted)' });
    }

    const { error } = await db.from('AssistantSkill').delete().eq('id', id);
    if (error) {
        console.error('[api/ai/skills/[id]] delete error:', error);
        return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Skill deleted' });
}
