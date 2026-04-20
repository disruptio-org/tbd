import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: draft } = await db
        .from('SalesDraft')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    return NextResponse.json({ draft });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: draft } = await db
        .from('SalesDraft')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    const { title, content, metadata } = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (metadata !== undefined) updates.metadata = metadata;

    await db.from('SalesDraft').update(updates).eq('id', id);
    return NextResponse.json({ success: true });
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: draft } = await db
        .from('SalesDraft')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    await db.from('SalesDraft').delete().eq('id', id);
    return NextResponse.json({ success: true });
}
