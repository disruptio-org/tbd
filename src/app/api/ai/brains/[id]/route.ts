// ─── GET /api/ai/brains/[id] — Get a specific brain ───
// ─── PATCH /api/ai/brains/[id] — Update a brain ──────
// ─── DELETE /api/ai/brains/[id] — Delete a brain ─────

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateBrainConfig, deepMergeBrainConfig } from '@/lib/ai-brains/schema';
import { invalidateBrainCache } from '@/lib/ai-brains/resolve-effective-brain';
import type { BrainConfig } from '@/lib/ai-brains/schema';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { data: brain } = await db
            .from('AIBrainProfile')
            .select('*')
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .maybeSingle();

        if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });

        // If role brain, compute effective config from parent
        let effectiveConfig = brain.configJson;
        if (brain.parentBrainId) {
            const { data: parent } = await db
                .from('AIBrainProfile')
                .select('configJson')
                .eq('id', brain.parentBrainId)
                .maybeSingle();

            if (parent) {
                effectiveConfig = deepMergeBrainConfig(
                    parent.configJson as unknown as BrainConfig,
                    brain.configJson as unknown as BrainConfig,
                );
            }
        }

        return NextResponse.json({ brain, effectiveConfig });
    } catch (error) {
        console.error('[ai/brains/[id]] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch brain' }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId, role').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Verify ownership
        const { data: existing } = await db
            .from('AIBrainProfile')
            .select('id, companyId')
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .maybeSingle();
        if (!existing) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });

        const body = await request.json();
        const updates: Record<string, unknown> = { updatedById: dbUser.id, updatedAt: new Date().toISOString() };

        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.description !== undefined) updates.description = body.description?.trim() || null;
        if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled;

        if (body.configJson !== undefined) {
            const validation = validateBrainConfig(body.configJson);
            if (!validation.valid) {
                return NextResponse.json({ error: 'Invalid config', details: validation.errors }, { status: 400 });
            }
            updates.configJson = body.configJson;
        }

        if (body.advancedInstructions !== undefined) {
            updates.advancedInstructions = body.advancedInstructions;
        }

        const { data: brain, error: updateErr } = await db
            .from('AIBrainProfile')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (updateErr) {
            console.error('[ai/brains/[id]] PATCH error:', updateErr);
            return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
        }

        // Invalidate cache
        invalidateBrainCache(dbUser.companyId);

        return NextResponse.json({ brain });
    } catch (error) {
        console.error('[ai/brains/[id]] PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update brain' }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId, role').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { error: delErr } = await db
            .from('AIBrainProfile')
            .delete()
            .eq('id', id)
            .eq('companyId', dbUser.companyId);

        if (delErr) {
            console.error('[ai/brains/[id]] DELETE error:', delErr);
            return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
        }

        invalidateBrainCache(dbUser.companyId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[ai/brains/[id]] DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete brain' }, { status: 500 });
    }
}
