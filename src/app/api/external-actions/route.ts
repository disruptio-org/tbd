import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/external-actions — List external actions for current company
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const { data: actions } = await db
        .from('ExternalAction')
        .select('id, name, description, toolName, serviceApp, inputSchema, isActive, createdAt')
        .eq('companyId', auth.dbUser.companyId)
        .eq('isActive', true)
        .order('serviceApp', { ascending: true })
        .order('name', { ascending: true });

    return NextResponse.json({ actions: actions || [] });
}
