/* ─── Room Leave ─── */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await params; // consume params

    const db = createAdminClient();
    const { error } = await db.from('OfficePresence').upsert(
        { id: crypto.randomUUID(), userId: auth.userId, companyId: auth.companyId, roomId: null, status: 'in_office', lastSeenAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { onConflict: 'userId,companyId' }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
