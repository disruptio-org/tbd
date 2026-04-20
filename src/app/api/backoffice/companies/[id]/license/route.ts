import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/backoffice/companies/[id]/license
 * Get license details for a company.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        const { data, error: dbErr } = await db
            .from('License')
            .select('*')
            .eq('companyId', id)
            .maybeSingle();

        if (dbErr) throw dbErr;

        if (!data) {
            return NextResponse.json({ error: 'No license found' }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error('[backoffice/license GET]', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

/**
 * PUT /api/backoffice/companies/[id]/license
 * Update license: plan, expiresAt, isActive.
 * Body: { plan?, expiresAt?, isActive? }
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const body = await request.json();
        const db = createAdminClient();

        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if (body.plan !== undefined) updates.plan = body.plan;
        if (body.expiresAt !== undefined) updates.expiresAt = body.expiresAt;
        if (body.isActive !== undefined) updates.isActive = body.isActive;

        // Upsert license (create if doesn't exist)
        const { data: existing } = await db
            .from('License')
            .select('id')
            .eq('companyId', id)
            .maybeSingle();

        let result;
        if (existing) {
            const { data, error: dbErr } = await db
                .from('License')
                .update(updates)
                .eq('companyId', id)
                .select()
                .single();
            if (dbErr) throw dbErr;
            result = data;
        } else {
            const { data, error: dbErr } = await db
                .from('License')
                .insert({
                    id: crypto.randomUUID(),
                    companyId: id,
                    ...updates,
                })
                .select()
                .single();
            if (dbErr) throw dbErr;
            result = data;
        }

        // Sync plan to Company if plan changed
        if (body.plan !== undefined) {
            await db
                .from('Company')
                .update({ plan: body.plan, updatedAt: new Date().toISOString() })
                .eq('id', id);
        }

        return NextResponse.json(result);
    } catch (err) {
        console.error('[backoffice/license PUT]', err);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
