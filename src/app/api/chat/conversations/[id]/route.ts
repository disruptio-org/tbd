import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/chat/conversations/[id] — get messages for a conversation
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const db = createAdminClient();

        // Verify conversation belongs to user's company
        const { data: dbUser } = await db.from('User').select('companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { data: conv } = await db
            .from('Conversation')
            .select('id, companyId')
            .eq('id', id)
            .single();

        if (!conv || conv.companyId !== dbUser.companyId) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        const { data: messages } = await db
            .from('Message')
            .select('id, role, content, createdAt')
            .eq('conversationId', id)
            .order('createdAt', { ascending: true });

        return NextResponse.json({
            conversationId: id,
            messages: messages ?? [],
        });
    } catch (error) {
        console.error('[conversation] CATCH:', error);
        return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
    }
}

/**
 * DELETE /api/chat/conversations/[id] — delete a conversation
 */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const db = createAdminClient();

        const { data: dbUser } = await db.from('User').select('companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify ownership
        const { data: conv } = await db
            .from('Conversation')
            .select('companyId')
            .eq('id', id)
            .single();

        if (!conv || conv.companyId !== dbUser.companyId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Delete messages first (cascade), then conversation
        await db.from('Message').delete().eq('conversationId', id);
        await db.from('Conversation').delete().eq('id', id);

        return NextResponse.json({ deleted: true });
    } catch (error) {
        console.error('[conversation delete] CATCH:', error);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
