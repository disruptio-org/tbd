/**
 * GET    /api/customers/[id] — Get customer detail with projects
 * PUT    /api/customers/[id] — Update customer
 * DELETE /api/customers/[id] — Archive customer (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: customer, error } = await db
        .from('Customer')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .single();

    if (error || !customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get projects for this customer
    const { data: projects } = await db
        .from('Project')
        .select('id, name, description, status, createdAt, updatedAt')
        .eq('customerId', id)
        .eq('companyId', auth.dbUser.companyId)
        .order('name');

    // Get DNA stats for this customer
    const { data: dnaNodes } = await db
        .from('KnowledgeNode')
        .select('type')
        .eq('customerId', id)
        .eq('status', 'active');

    const nodesByType: Record<string, number> = {};
    for (const n of dnaNodes || []) {
        nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
    }

    return NextResponse.json({
        ...customer,
        projects: projects || [],
        dnaStats: {
            nodeCount: (dnaNodes || []).length,
            nodesByType,
        },
    });
}

export async function PUT(req: NextRequest, { params }: Params) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { name, description, industry, website, contactName, contactEmail, status } = body;

    const db = createAdminClient();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (industry !== undefined) updates.industry = industry;
    if (website !== undefined) updates.website = website;
    if (contactName !== undefined) updates.contactName = contactName;
    if (contactEmail !== undefined) updates.contactEmail = contactEmail;
    if (status !== undefined) updates.status = status;

    const { data, error } = await db
        .from('Customer')
        .update(updates)
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    // Soft delete — set status to archived
    const { error } = await db
        .from('Customer')
        .update({ status: 'archived' })
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
