/* ─── Presence API ─── */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';

/** GET /api/virtual-office/presence — All company presence */
export async function GET() {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const { data } = await db
        .from('OfficePresence')
        .select('*')
        .eq('companyId', auth.companyId);

    return NextResponse.json({ presence: data || [] });
}

/** PATCH /api/virtual-office/presence — Update own status */
export async function PATCH(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const db = createAdminClient();

    const updates: Record<string, unknown> = { lastSeenAt: new Date().toISOString() };
    if (body.status) updates.status = body.status;
    if (body.audioState) updates.audioState = body.audioState;
    if (body.videoState) updates.videoState = body.videoState;

    const { error } = await db.from('OfficePresence').upsert(
        { id: crypto.randomUUID(), userId: auth.userId, companyId: auth.companyId, ...updates, updatedAt: new Date().toISOString() },
        { onConflict: 'userId,companyId' }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
