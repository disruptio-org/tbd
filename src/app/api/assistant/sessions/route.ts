import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/assistant/sessions
 * List recent assistant sessions for the current user, enriched with first message preview.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: sessions, error } = await db
            .from('AssistantSession')
            .select('id, currentRoute, status, startedAt')
            .eq('userId', auth.dbUser.id)
            .eq('companyId', auth.dbUser.companyId)
            .order('startedAt', { ascending: false })
            .limit(20);

        if (error) throw error;

        // Enrich each session with first user message
        const enriched = await Promise.all((sessions || []).map(async (s) => {
            const { data: firstMsg } = await db
                .from('AssistantMessage')
                .select('content')
                .eq('sessionId', s.id)
                .eq('role', 'USER')
                .order('createdAt', { ascending: true })
                .limit(1)
                .maybeSingle();

            const { count } = await db
                .from('AssistantMessage')
                .select('id', { count: 'exact', head: true })
                .eq('sessionId', s.id);

            return {
                id: s.id,
                status: s.status,
                startedAt: s.startedAt,
                firstUserMessage: firstMsg?.content
                    ? firstMsg.content.length > 80
                        ? firstMsg.content.substring(0, 80) + '…'
                        : firstMsg.content
                    : null,
                messageCount: count || 0,
            };
        }));

        return NextResponse.json({ sessions: enriched });
    } catch (err) {
        console.error('[/api/assistant/sessions] GET error:', err);
        return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }
}
