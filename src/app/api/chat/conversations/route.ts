import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/chat/conversations — list user's conversations
 */
export async function GET() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const db = createAdminClient();

        const { data: dbUser } = await db.from('User').select('companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) {
            return NextResponse.json([]);
        }

        const { data: conversations } = await db
            .from('Conversation')
            .select('id, title, createdAt, updatedAt')
            .eq('companyId', dbUser.companyId)
            .order('updatedAt', { ascending: false })
            .limit(50);

        return NextResponse.json(conversations ?? []);
    } catch (error) {
        console.error('[conversations] CATCH:', error);
        return NextResponse.json([]);
    }
}
