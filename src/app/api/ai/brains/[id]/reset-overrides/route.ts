// ─── POST /api/ai/brains/[id]/reset-overrides — Reset role brain to inherited ──

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

        // Load brain
        const { data: brain } = await db
            .from('AIBrainProfile')
            .select('id, companyId, parentBrainId')
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .maybeSingle();
        if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
        if (!brain.parentBrainId) {
            return NextResponse.json({ error: 'Cannot reset Company Brain — it has no parent' }, { status: 400 });
        }

        // Load parent config
        const { data: parent } = await db
            .from('AIBrainProfile')
            .select('configJson, advancedInstructions')
            .eq('id', brain.parentBrainId)
            .maybeSingle();

        if (!parent) return NextResponse.json({ error: 'Parent brain not found' }, { status: 404 });

        const body = await request.json().catch(() => ({}));
        const sections = body.sections as string[] | undefined; // Optional: only reset specific sections

        if (sections && sections.length > 0) {
            // Partial reset: only reset specified sections to parent values
            const currentConfig = (await db.from('AIBrainProfile').select('configJson').eq('id', id).single()).data?.configJson as Record<string, unknown>;
            const parentConfig = parent.configJson as Record<string, unknown>;

            const updatedConfig = { ...currentConfig };
            for (const section of sections) {
                if (parentConfig[section] !== undefined) {
                    updatedConfig[section] = parentConfig[section];
                }
            }

            await db.from('AIBrainProfile').update({
                configJson: updatedConfig,
                updatedById: dbUser.id,
                updatedAt: new Date().toISOString(),
            }).eq('id', id);
        } else {
            // Full reset: copy parent config entirely
            await db.from('AIBrainProfile').update({
                configJson: parent.configJson,
                advancedInstructions: parent.advancedInstructions,
                updatedById: dbUser.id,
                updatedAt: new Date().toISOString(),
            }).eq('id', id);
        }

        // Clear overrides
        await db.from('AIBrainOverride').delete().eq('brainProfileId', id);

        invalidateBrainCache(dbUser.companyId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[ai/brains/[id]/reset-overrides] error:', error);
        return NextResponse.json({ error: 'Failed to reset overrides' }, { status: 500 });
    }
}
