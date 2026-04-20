/**
 * PUT    /api/dna/resources/[id] — Update a resource
 * DELETE /api/dna/resources/[id] — Delete a (non-default) resource
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const companyId = auth.dbUser.companyId;
    const db = createAdminClient();
    const body = await request.json();

    // Verify ownership
    const { data: existing } = await db
        .from('Resource')
        .select('id, companyId')
        .eq('id', id)
        .eq('companyId', companyId)
        .single();

    if (!existing) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.nodeTypes !== undefined) updates.nodeTypes = body.nodeTypes;

    const { data, error } = await db
        .from('Resource')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const companyId = auth.dbUser.companyId;
    const db = createAdminClient();

    // Verify ownership and check isDefault
    const { data: existing } = await db
        .from('Resource')
        .select('id, companyId, isDefault')
        .eq('id', id)
        .eq('companyId', companyId)
        .single();

    if (!existing) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (existing.isDefault) {
        return NextResponse.json({ error: 'Cannot delete a default resource' }, { status: 403 });
    }

    const { error } = await db
        .from('Resource')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
