/**
 * GET  /api/customers      — List all customers for the current company
 * POST /api/customers       — Create a new customer
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const { data, error } = await db
        .from('Customer')
        .select('*, projects:Project(id)')
        .eq('companyId', auth.dbUser.companyId)
        .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(
        (data || []).map((c: Record<string, unknown>) => ({
            ...c,
            projectCount: Array.isArray(c.projects) ? c.projects.length : 0,
            projects: undefined,
        })),
    );
}

export async function POST(req: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, description, industry, website, contactName, contactEmail } = body;

    if (!name?.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data, error } = await db
        .from('Customer')
        .insert({
            id: crypto.randomUUID(),
            companyId: auth.dbUser.companyId,
            name: name.trim(),
            description: description || null,
            industry: industry || null,
            website: website || null,
            contactName: contactName || null,
            contactEmail: contactEmail || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'A customer with this name already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
