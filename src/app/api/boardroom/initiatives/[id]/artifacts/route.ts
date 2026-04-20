import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/boardroom/initiatives/[id]/artifacts — List artifacts
 */
export async function GET(_req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();

    const { data: initiative } = await db
        .from('Initiative')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const { data: artifacts } = await db
        .from('InitiativeArtifact')
        .select('*')
        .eq('initiativeId', id)
        .order('createdAt', { ascending: false });

    return NextResponse.json({ artifacts: artifacts || [] });
}

/**
 * POST /api/boardroom/initiatives/[id]/artifacts — Add an artifact
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();

    const { data: initiative } = await db
        .from('Initiative')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const body = await req.json();
    const { taskId, artifactType, title, content, contentUrl, sourceRunId, sourceRunType } = body;

    if (!title?.trim() || !artifactType) {
        return NextResponse.json({ error: 'title and artifactType are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const artifactId = crypto.randomUUID();

    await db.from('InitiativeArtifact').insert({
        id: artifactId,
        initiativeId: id,
        taskId: taskId || null,
        artifactType,
        title: title.trim(),
        content: content || null,
        contentUrl: contentUrl || null,
        sourceRunId: sourceRunId || null,
        sourceRunType: sourceRunType || null,
        status: 'DRAFT',
        updatedAt: now,
    });

    // Log event
    await db.from('InitiativeEvent').insert({
        id: crypto.randomUUID(),
        initiativeId: id,
        actorType: 'system',
        actorLabel: 'System',
        action: 'artifact_added',
        description: `Artifact "${title.trim()}" (${artifactType}) added`,
    });

    return NextResponse.json({ artifact: { id: artifactId, artifactType, title: title.trim() } });
}
