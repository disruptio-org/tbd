// ─── GET /api/ai/brains — List brains for company ─────
// ─── POST /api/ai/brains — Create a new draft brain ───

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDefaultBrainConfig } from '@/lib/ai-brains/defaults';
import { validateBrainConfig } from '@/lib/ai-brains/schema';
import type { BrainType } from '@/lib/ai-brains/schema';

export async function GET() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId, role').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { data: brains } = await db
            .from('AIBrainProfile')
            .select('id, brainType, name, description, parentBrainId, status, isEnabled, configJson, createdAt, updatedAt')
            .eq('companyId', dbUser.companyId)
            .order('createdAt', { ascending: true });

        return NextResponse.json({ brains: brains || [] });
    } catch (error) {
        console.error('[ai/brains] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch brains' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId, role').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Only ADMIN and SUPER_ADMIN can create brains
        if (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { brainType, name, description, configJson, advancedInstructions, parentBrainId } = body;

        if (!brainType || !name) {
            return NextResponse.json({ error: 'brainType and name are required' }, { status: 400 });
        }

        // Check uniqueness: only one brain per type per company
        const { data: existing } = await db
            .from('AIBrainProfile')
            .select('id')
            .eq('companyId', dbUser.companyId)
            .eq('brainType', brainType)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: `Brain of type ${brainType} already exists for this company` }, { status: 409 });
        }

        // Use provided config or defaults
        const config = configJson || getDefaultBrainConfig(brainType as BrainType);

        const validation = validateBrainConfig(config);
        if (!validation.valid) {
            return NextResponse.json({ error: 'Invalid config', details: validation.errors }, { status: 400 });
        }

        // For role brains, find parent company brain
        let resolvedParentId = parentBrainId || null;
        if (brainType !== 'COMPANY' && !resolvedParentId) {
            const { data: companyBrain } = await db
                .from('AIBrainProfile')
                .select('id')
                .eq('companyId', dbUser.companyId)
                .eq('brainType', 'COMPANY')
                .maybeSingle();
            resolvedParentId = companyBrain?.id || null;
        }

        const { data: brain, error: createErr } = await db
            .from('AIBrainProfile')
            .insert({
                id: crypto.randomUUID(),
                companyId: dbUser.companyId,
                brainType,
                name: name.trim(),
                description: description?.trim() || null,
                parentBrainId: resolvedParentId,
                status: 'DRAFT',
                isEnabled: true,
                configJson: config,
                advancedInstructions: advancedInstructions || null,
                createdById: dbUser.id,
                updatedById: dbUser.id,
                updatedAt: new Date().toISOString(),
            })
            .select()
            .single();

        if (createErr) {
            console.error('[ai/brains] Create error:', createErr);
            return NextResponse.json({ error: 'Failed to create brain' }, { status: 500 });
        }

        return NextResponse.json({ brain }, { status: 201 });
    } catch (error) {
        console.error('[ai/brains] POST error:', error);
        return NextResponse.json({ error: 'Failed to create brain' }, { status: 500 });
    }
}
