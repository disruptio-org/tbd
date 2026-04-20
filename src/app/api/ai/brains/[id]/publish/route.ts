// ─── POST /api/ai/brains/[id]/publish — Publish draft as active ──

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { invalidateBrainCache } from '@/lib/ai-brains/resolve-effective-brain';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
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

        // Load the brain
        const { data: brain } = await db
            .from('AIBrainProfile')
            .select('*')
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .maybeSingle();

        if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });

        const body = await request.json().catch(() => ({}));
        const changeSummary = body.changeSummary || null;

        // Get current max version number
        const { data: versions } = await db
            .from('AIBrainVersion')
            .select('versionNumber')
            .eq('brainProfileId', id)
            .order('versionNumber', { ascending: false })
            .limit(1);

        const nextVersion = (versions?.[0]?.versionNumber || 0) + 1;

        // Mark any existing ACTIVE version as ROLLED_BACK
        await db
            .from('AIBrainVersion')
            .update({ status: 'ROLLED_BACK' })
            .eq('brainProfileId', id)
            .eq('status', 'ACTIVE');

        // Create new version snapshot
        const { error: versionErr } = await db
            .from('AIBrainVersion')
            .insert({
                id: crypto.randomUUID(),
                brainProfileId: id,
                versionNumber: nextVersion,
                status: 'ACTIVE',
                configSnapshotJson: brain.configJson,
                advancedInstructionsSnapshot: brain.advancedInstructions,
                changeSummary,
                publishedAt: new Date().toISOString(),
                createdById: dbUser.id,
                createdAt: new Date().toISOString(),
            });

        if (versionErr) {
            console.error('[ai/brains/[id]/publish] version create error:', versionErr);
            return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
        }

        // Set brain status to ACTIVE
        await db
            .from('AIBrainProfile')
            .update({
                status: 'ACTIVE',
                updatedById: dbUser.id,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', id);

        // Invalidate cache
        invalidateBrainCache(dbUser.companyId);

        return NextResponse.json({ success: true, versionNumber: nextVersion });
    } catch (error) {
        console.error('[ai/brains/[id]/publish] error:', error);
        return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
    }
}
