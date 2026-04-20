import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/assistant/sessions/[id]
 * Get full session detail with messages and action runs.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    try {
        // Verify session ownership
        const { data: session } = await db
            .from('AssistantSession')
            .select('*')
            .eq('id', id)
            .eq('userId', auth.dbUser.id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        // Get messages
        const { data: messages } = await db
            .from('AssistantMessage')
            .select('*')
            .eq('sessionId', id)
            .order('createdAt', { ascending: true });

        // Get action runs
        const { data: actionRuns } = await db
            .from('AssistantActionRun')
            .select('*')
            .eq('sessionId', id)
            .order('createdAt', { ascending: true });

        return NextResponse.json({
            session,
            messages: messages || [],
            actionRuns: actionRuns || [],
        });
    } catch (err) {
        console.error('[/api/assistant/sessions/[id]] GET error:', err);
        return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
    }
}
