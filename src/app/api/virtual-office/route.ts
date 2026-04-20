/* ─── Virtual Office API — Office CRUD ─── */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTemplate } from '@/lib/virtual-office/templates';

/**
 * GET /api/virtual-office
 * Fetch the company's office. Auto-creates with default template if none exists.
 */
export async function GET() {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();

    // Check existing
    const { data: office } = await db
        .from('VirtualOffice')
        .select('*, rooms:VirtualRoom(*, occupants:OfficePresence(*))')
        .eq('companyId', auth.companyId)
        .maybeSingle();

    if (office) {
        // Also fetch presence for all company members
        const { data: presence } = await db
            .from('OfficePresence')
            .select('*')
            .eq('companyId', auth.companyId);

        // Fetch user info for occupants
        const { data: users } = await db
            .from('User')
            .select('id, name, email, avatarUrl, role')
            .eq('companyId', auth.companyId)
            .eq('status', 'ACTIVE');

        return NextResponse.json({ office, presence: presence || [], users: users || [] });
    }

    // Auto-create with startup template
    const template = getTemplate('startup');
    const officeId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { data: newOffice, error: officeErr } = await db
        .from('VirtualOffice')
        .insert({
            id: officeId,
            companyId: auth.companyId,
            name: template.label,
            template: template.key,
            createdAt: now,
            updatedAt: now,
        })
        .select()
        .single();

    if (officeErr || !newOffice) {
        console.error('[VirtualOffice] Create error:', officeErr);
        return NextResponse.json({ error: 'failed to create office', detail: officeErr?.message, code: officeErr?.code, hint: officeErr?.hint }, { status: 500 });
    }

    // Create template rooms
    const roomInserts = template.rooms.map(r => ({
        id: crypto.randomUUID(),
        officeId: newOffice.id,
        name: r.name,
        type: r.type,
        capacity: r.capacity,
        privacy: r.privacy,
        position: r.position,
        createdBy: auth.userId,
        createdAt: now,
        updatedAt: now,
    }));

    await db.from('VirtualRoom').insert(roomInserts);

    // Re-fetch with rooms
    const { data: fullOffice } = await db
        .from('VirtualOffice')
        .select('*, rooms:VirtualRoom(*, occupants:OfficePresence(*))')
        .eq('id', newOffice.id)
        .single();

    // Upsert user presence
    await db.from('OfficePresence').upsert(
        { id: crypto.randomUUID(), userId: auth.userId, companyId: auth.companyId, status: 'in_office', lastSeenAt: now, updatedAt: now },
        { onConflict: 'userId,companyId' }
    );

    const { data: presence } = await db
        .from('OfficePresence')
        .select('*')
        .eq('companyId', auth.companyId);

    const { data: users } = await db
        .from('User')
        .select('id, name, email, avatarUrl, role')
        .eq('companyId', auth.companyId)
        .eq('status', 'ACTIVE');

    return NextResponse.json({ office: fullOffice, presence: presence || [], users: users || [] });
}

/**
 * PATCH /api/virtual-office
 * Update office name or layout config (admin only)
 */
export async function PATCH(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.role !== 'ADMIN' && auth.role !== 'OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const db = createAdminClient();

    const { data, error } = await db
        .from('VirtualOffice')
        .update({
            ...(body.name && { name: body.name }),
            ...(body.layoutConfig && { layoutConfig: body.layoutConfig }),
        })
        .eq('companyId', auth.companyId)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ office: data });
}
