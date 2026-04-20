import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/tasks/[id]/comments — List comments for task
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    // Verify task ownership
    const { data: task } = await db
        .from('Task')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const { data: comments } = await db
        .from('TaskComment')
        .select('*')
        .eq('taskId', id)
        .order('createdAt', { ascending: true });

    // Enrich with user info
    const userIds = [...new Set((comments || []).map(c => c.userId))];
    let usersMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    if (userIds.length > 0) {
        const { data: users } = await db.from('User').select('id, name, avatarUrl').in('id', userIds);
        usersMap = Object.fromEntries((users || []).map(u => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));
    }

    const enriched = (comments || []).map(c => ({
        ...c,
        userName: usersMap[c.userId]?.name || 'Unknown',
        userAvatar: usersMap[c.userId]?.avatarUrl || null,
    }));

    return NextResponse.json({ comments: enriched });
}

/**
 * POST /api/tasks/[id]/comments — Add comment
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { content } = await req.json();

    if (!content?.trim()) {
        return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    const db = createAdminClient();

    const { data: task } = await db
        .from('Task')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.from('TaskComment').insert({
        id: commentId,
        taskId: id,
        userId: auth.dbUser.id,
        content: content.trim(),
        updatedAt: now,
    });

    // Log activity
    await db.from('TaskActivity').insert({
        id: crypto.randomUUID(),
        taskId: id,
        actorId: auth.dbUser.id,
        action: 'commented',
        metadata: { preview: content.trim().substring(0, 100) },
    });

    return NextResponse.json({
        comment: {
            id: commentId,
            taskId: id,
            userId: auth.dbUser.id,
            content: content.trim(),
            userName: auth.dbUser.name,
            userAvatar: auth.dbUser.avatarUrl || null,
            createdAt: now,
        },
    });
}
