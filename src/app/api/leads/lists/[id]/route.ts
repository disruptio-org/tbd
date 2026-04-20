import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/leads/lists/[id]
 * Get a specific list with its lead items.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    try {
        const { data: list } = await db
            .from('LeadList')
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

        // Get items + lead data
        const { data: items } = await db
            .from('LeadListItem')
            .select('id, leadResultId, notes, createdAt')
            .eq('leadListId', id)
            .order('createdAt', { ascending: true });

        let leads: Record<string, unknown>[] = [];
        if (items && items.length > 0) {
            const resultIds = items.map(i => i.leadResultId);
            const { data: results } = await db
                .from('LeadResult')
                .select('*')
                .in('id', resultIds);
            leads = results || [];
        }

        // Merge items with lead data
        const enrichedItems = (items || []).map(item => {
            const lead = leads.find((l: Record<string, unknown>) => l.id === item.leadResultId);
            return { ...item, lead };
        });

        return NextResponse.json({ list, items: enrichedItems });
    } catch (err) {
        console.error('[/api/leads/lists/[id] GET]', err);
        return NextResponse.json({ error: 'Failed to fetch list' }, { status: 500 });
    }
}

/**
 * PATCH /api/leads/lists/[id]
 * Update list (rename, add items, remove items).
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    try {
        // Verify ownership
        const { data: list } = await db
            .from('LeadList')
            .select('id')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

        const { name, description, addLeadIds, removeLeadIds } = await request.json();

        // Update metadata
        if (name !== undefined || description !== undefined) {
            const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
            if (name !== undefined) updates.name = name;
            if (description !== undefined) updates.description = description;
            await db.from('LeadList').update(updates).eq('id', id);
        }

        // Add items
        if (addLeadIds && Array.isArray(addLeadIds) && addLeadIds.length > 0) {
            const newItems = addLeadIds.map((resultId: string) => ({
                id: crypto.randomUUID(),
                leadListId: id,
                leadResultId: resultId,
            }));
            await db.from('LeadListItem').upsert(newItems, { onConflict: 'leadListId,leadResultId' });
        }

        // Remove items
        if (removeLeadIds && Array.isArray(removeLeadIds) && removeLeadIds.length > 0) {
            await db.from('LeadListItem')
                .delete()
                .eq('leadListId', id)
                .in('leadResultId', removeLeadIds);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/leads/lists/[id] PATCH]', err);
        return NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
    }
}

/**
 * DELETE /api/leads/lists/[id]
 * Delete a lead list.
 */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    try {
        const { data: list } = await db
            .from('LeadList')
            .select('id')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

        await db.from('LeadListItem').delete().eq('leadListId', id);
        await db.from('LeadList').delete().eq('id', id);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/leads/lists/[id] DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
    }
}
