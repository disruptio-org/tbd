// ─── POST /api/ai/brains/[id]/rollback — Rollback to a previous version ──

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

        const body = await request.json();
        const { versionId } = body;
        if (!versionId) return NextResponse.json({ error: 'versionId is required' }, { status: 400 });

        // Verify brain ownership
        const { data: brain } = await db
            .from('AIBrainProfile')
            .select('id, companyId')
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .maybeSingle();
        if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });

        // Load the version to rollback to
        const { data: version } = await db
            .from('AIBrainVersion')
            .select('*')
            .eq('id', versionId)
            .eq('brainProfileId', id)
            .maybeSingle();
        if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

        // Update brain config to version snapshot
        await db
            .from('AIBrainProfile')
            .update({
                configJson: version.configSnapshotJson,
                advancedInstructions: version.advancedInstructionsSnapshot,
                status: 'ACTIVE',
                updatedById: dbUser.id,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', id);

        // Mark current active version as rolled back
        await db
            .from('AIBrainVersion')
            .update({ status: 'ROLLED_BACK' })
            .eq('brainProfileId', id)
            .eq('status', 'ACTIVE');

        // Create a new version from the rollback snapshot
        const { data: latestVersion } = await db
            .from('AIBrainVersion')
            .select('versionNumber')
            .eq('brainProfileId', id)
            .order('versionNumber', { ascending: false })
            .limit(1);

        const nextVersion = (latestVersion?.[0]?.versionNumber || 0) + 1;

        await db
            .from('AIBrainVersion')
            .insert({
                id: crypto.randomUUID(),
                brainProfileId: id,
                versionNumber: nextVersion,
                status: 'ACTIVE',
                configSnapshotJson: version.configSnapshotJson,
                advancedInstructionsSnapshot: version.advancedInstructionsSnapshot,
                changeSummary: `Rollback to version ${version.versionNumber}`,
                publishedAt: new Date().toISOString(),
                createdById: dbUser.id,
                createdAt: new Date().toISOString(),
            });

        invalidateBrainCache(dbUser.companyId);

        return NextResponse.json({ success: true, rolledBackToVersion: version.versionNumber, newVersion: nextVersion });
    } catch (error) {
        console.error('[ai/brains/[id]/rollback] error:', error);
        return NextResponse.json({ error: 'Failed to rollback' }, { status: 500 });
    }
}
