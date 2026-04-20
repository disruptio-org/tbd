// ─── GET /api/ai/brain-templates — List built-in templates ──

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { BUILT_IN_TEMPLATES } from '@/lib/ai-brains/templates';

export async function GET() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        return NextResponse.json({ templates: BUILT_IN_TEMPLATES });
    } catch (error) {
        console.error('[ai/brain-templates] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}
