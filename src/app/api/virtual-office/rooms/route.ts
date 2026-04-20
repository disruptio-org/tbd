/* ─── Virtual Office API — Rooms CRUD ─── */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';

/** GET /api/virtual-office/rooms — List rooms */
export async function GET() {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const { data: office } = await db
        .from('VirtualOffice')
        .select('id')
        .eq('companyId', auth.companyId)
        .maybeSingle();

    if (!office) return NextResponse.json({ rooms: [] });

    const { data: rooms } = await db
        .from('VirtualRoom')
        .select('*, occupants:OfficePresence(*)')
        .eq('officeId', office.id)
        .order('createdAt', { ascending: true });

    return NextResponse.json({ rooms: rooms || [] });
}

/** POST /api/virtual-office/rooms — Create room (admin) */
export async function POST(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.role !== 'ADMIN' && auth.role !== 'OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const db = createAdminClient();

    const { data: office } = await db
        .from('VirtualOffice')
        .select('id')
        .eq('companyId', auth.companyId)
        .maybeSingle();

    if (!office) return NextResponse.json({ error: 'No office found' }, { status: 404 });

    const { data: room, error } = await db
        .from('VirtualRoom')
        .insert({
            id: crypto.randomUUID(),
            officeId: office.id,
            name: body.name || 'New Room',
            type: body.type || 'MEETING_ROOM',
            capacity: body.capacity || 8,
            privacy: body.privacy || 'public',
            position: body.position || { x: 0, y: 0, w: 1, h: 1 },
            createdBy: auth.userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ room }, { status: 201 });
}
