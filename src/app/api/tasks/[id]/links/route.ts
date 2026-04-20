import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/tasks/[id]/links — Add link to task
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { linkType, entityId, url, label } = await req.json();

    if (!linkType) {
        return NextResponse.json({ error: 'linkType is required' }, { status: 400 });
    }

    const db = createAdminClient();

    const { data: task } = await db
        .from('Task')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const linkId = crypto.randomUUID();

    await db.from('TaskLink').insert({
        id: linkId,
        taskId: id,
        linkType,
        entityId: entityId || null,
        url: url || null,
        label: label || null,
    });

    // Log activity
    await db.from('TaskActivity').insert({
        id: crypto.randomUUID(),
        taskId: id,
        actorId: auth.dbUser.id,
        action: 'linked',
        metadata: { linkType, label: label || linkType },
    });

    return NextResponse.json({ link: { id: linkId, taskId: id, linkType, entityId, url, label } });
}

/**
 * DELETE /api/tasks/[id]/links — Remove link
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('linkId');

    if (!linkId) return NextResponse.json({ error: 'linkId is required' }, { status: 400 });

    const db = createAdminClient();

    const { data: task } = await db
        .from('Task')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    await db.from('TaskLink').delete().eq('id', linkId).eq('taskId', id);

    return NextResponse.json({ success: true });
}

/**
 * PATCH /api/tasks/[id]/links — Update link entityId (used after assistant generation)
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { linkType, entityId } = await req.json();

    if (!linkType || !entityId) {
        return NextResponse.json({ error: 'linkType and entityId are required' }, { status: 400 });
    }

    const db = createAdminClient();

    const { data: task } = await db
        .from('Task')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // Find existing link by type and update its entityId
    const { data: link } = await db
        .from('TaskLink')
        .select('id')
        .eq('taskId', id)
        .eq('linkType', linkType)
        .maybeSingle();

    if (link) {
        await db.from('TaskLink').update({ entityId }).eq('id', link.id);
        return NextResponse.json({ success: true, linkId: link.id });
    }

    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
}
