import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';

/**
 * GET /api/ai/members/[id]/history
 * Returns past conversation sessions for this AI member.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: memberId } = await params;
    const supabase = createAdminClient();

    // Fetch sessions scoped to this brain
    const { data: sessions } = await supabase
        .from('AssistantSession')
        .select('id, startedAt, status')
        .eq('companyId', auth.companyId)
        .eq('brainProfileId', memberId)
        .order('startedAt', { ascending: false })
        .limit(30);

    if (!sessions || sessions.length === 0) {
        return NextResponse.json({ sessions: [] });
    }

    // For each session, count messages and get the last one
    const enriched = await Promise.all(
        sessions.map(async (session: { id: string; startedAt: string; status: string }) => {
            const { data: msgs, count } = await supabase
                .from('AssistantMessage')
                .select('content', { count: 'exact' })
                .eq('sessionId', session.id)
                .eq('role', 'USER')
                .order('createdAt', { ascending: false })
                .limit(1);

            return {
                id: session.id,
                startedAt: session.startedAt,
                status: session.status,
                messageCount: count || 0,
                lastMessage: msgs?.[0]?.content
                    ? (msgs[0].content.length > 100 ? msgs[0].content.slice(0, 100) + '…' : msgs[0].content)
                    : undefined,
            };
        }),
    );

    return NextResponse.json({ sessions: enriched });
}
