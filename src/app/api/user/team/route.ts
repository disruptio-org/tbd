import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/user/team — List all users in the same company (for assignee dropdown)
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const { data: users } = await db
        .from('User')
        .select('id, name, avatarUrl')
        .eq('companyId', auth.dbUser.companyId)
        .order('name', { ascending: true });

    return NextResponse.json({ users: users || [] });
}
