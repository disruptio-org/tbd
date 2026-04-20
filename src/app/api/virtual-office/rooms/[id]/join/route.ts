/* ─── Room Join ─── */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const db = createAdminClient();

    // Check room exists and capacity
    const { data: room } = await db.from('VirtualRoom').select('id, capacity').eq('id', id).single();
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const { count } = await db.from('OfficePresence').select('*', { count: 'exact', head: true }).eq('roomId', id);
    if ((count || 0) >= room.capacity) {
        return NextResponse.json({ error: 'Room at capacity' }, { status: 409 });
    }

    // Upsert presence
    const { error } = await db.from('OfficePresence').upsert(
        { id: crypto.randomUUID(), userId: auth.userId, companyId: auth.companyId, roomId: id, status: 'in_room', lastSeenAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { onConflict: 'userId,companyId' }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, roomId: id });
}
