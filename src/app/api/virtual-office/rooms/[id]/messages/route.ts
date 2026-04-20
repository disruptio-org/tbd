/* ─── Room Messages API ─── */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';

/** GET /api/virtual-office/rooms/[id]/messages */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const db = createAdminClient();
    const { data } = await db
        .from('RoomMessage')
        .select('*')
        .eq('roomId', id)
        .order('createdAt', { ascending: true })
        .limit(100);

    return NextResponse.json({ messages: data || [] });
}

/** POST /api/virtual-office/rooms/[id]/messages */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const body = await req.json();
    if (!body.content?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

    const db = createAdminClient();
    const { data, error } = await db
        .from('RoomMessage')
        .insert({ id: crypto.randomUUID(), roomId: id, userId: auth.userId, content: body.content.trim() })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: data }, { status: 201 });
}
