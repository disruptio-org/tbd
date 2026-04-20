// ─── POST /api/ai/brains/[id]/apply-template — Apply a template to a brain ──

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTemplateById } from '@/lib/ai-brains/templates';
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
        const { templateId } = body;
        if (!templateId) return NextResponse.json({ error: 'templateId is required' }, { status: 400 });

        // Verify brain ownership
        const { data: brain } = await db
            .from('AIBrainProfile')
            .select('id, companyId')
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .maybeSingle();
        if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });

        // Find template
        const template = getTemplateById(templateId);
        if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

        // Apply template config
        await db.from('AIBrainProfile').update({
            configJson: template.config,
            updatedById: dbUser.id,
            updatedAt: new Date().toISOString(),
        }).eq('id', id);

        invalidateBrainCache(dbUser.companyId);

        return NextResponse.json({ success: true, appliedTemplate: template.name });
    } catch (error) {
        console.error('[ai/brains/[id]/apply-template] error:', error);
        return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 });
    }
}
