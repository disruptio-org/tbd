/* ─── Virtual Office API — Room Detail ─── */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';

/** GET /api/virtual-office/rooms/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const db = createAdminClient();
    const { data: room } = await db
        .from('VirtualRoom')
        .select('*, occupants:OfficePresence(*), messages:RoomMessage(*)')
        .eq('id', id)
        .single();

    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    return NextResponse.json({ room });
}

/** PATCH /api/virtual-office/rooms/[id] — Update room */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.role !== 'ADMIN' && auth.role !== 'OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const db = createAdminClient();

    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name;
    if (body.type) updates.type = body.type;
    if (body.capacity) updates.capacity = body.capacity;
    if (body.privacy) updates.privacy = body.privacy;
    if (body.position) updates.position = body.position;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    const { data, error } = await db
        .from('VirtualRoom')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ room: data });
}

/** DELETE /api/virtual-office/rooms/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.role !== 'ADMIN' && auth.role !== 'OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const db = createAdminClient();

    const { error } = await db.from('VirtualRoom').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
