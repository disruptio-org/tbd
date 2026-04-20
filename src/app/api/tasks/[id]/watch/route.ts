import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/tasks/[id]/watch — Toggle watch on/off for current user
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: task } = await db.from('Task').select('id').eq('id', id).eq('companyId', auth.dbUser.companyId).maybeSingle();
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // Check if already watching
    const { data: existing } = await db
        .from('TaskWatcher')
        .select('id')
        .eq('taskId', id)
        .eq('userId', auth.dbUser.id)
        .maybeSingle();

    if (existing) {
        // Unwatch
        await db.from('TaskWatcher').delete().eq('id', existing.id);
        return NextResponse.json({ watching: false });
    } else {
        // Watch
        await db.from('TaskWatcher').insert({
            id: crypto.randomUUID(),
            taskId: id,
            userId: auth.dbUser.id,
        });

        await db.from('TaskActivity').insert({
            id: crypto.randomUUID(),
            taskId: id,
            actorId: auth.dbUser.id,
            action: 'watched',
            metadata: {},
        });

        return NextResponse.json({ watching: true });
    }
}
