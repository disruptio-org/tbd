import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/boardroom/initiatives/[id]/events — Activity log
 */
export async function GET(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const { data: initiative } = await db
        .from('Initiative')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const { data: events } = await db
        .from('InitiativeEvent')
        .select('*')
        .eq('initiativeId', id)
        .order('createdAt', { ascending: false })
        .limit(limit);

    return NextResponse.json({ events: events || [] });
}
