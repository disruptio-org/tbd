import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/leads/lists
 * Create a new saved lead list.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, description, sourceSearchRunId, leadResultIds } = await request.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const listId = crypto.randomUUID();

        await db.from('LeadList').insert({
            id: listId,
            companyId: auth.dbUser.companyId,
            userId: auth.dbUser.id,
            name: name.trim(),
            description: description || null,
            sourceSearchRunId: sourceSearchRunId || null,
            updatedAt: new Date().toISOString(),
        });

        // Add items if provided
        if (leadResultIds && Array.isArray(leadResultIds) && leadResultIds.length > 0) {
            const items = leadResultIds.map((resultId: string) => ({
                id: crypto.randomUUID(),
                leadListId: listId,
                leadResultId: resultId,
            }));
            await db.from('LeadListItem').insert(items);
        }

        return NextResponse.json({ id: listId, success: true });
    } catch (err) {
        console.error('[/api/leads/lists POST]', err);
        return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
    }
}

/**
 * GET /api/leads/lists
 * Get all saved lead lists for the company.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: lists, error } = await db
            .from('LeadList')
            .select('id, name, description, sourceSearchRunId, createdAt, updatedAt')
            .eq('companyId', auth.dbUser.companyId)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        // Get item counts
        const listIds = (lists || []).map(l => l.id);
        let itemCounts: Record<string, number> = {};

        if (listIds.length > 0) {
            const { data: items } = await db
                .from('LeadListItem')
                .select('leadListId')
                .in('leadListId', listIds);

            if (items) {
                for (const item of items) {
                    itemCounts[item.leadListId] = (itemCounts[item.leadListId] || 0) + 1;
                }
            }
        }

        return NextResponse.json({
            lists: (lists || []).map(list => ({
                ...list,
                itemCount: itemCounts[list.id] || 0,
            })),
        });
    } catch (err) {
        console.error('[/api/leads/lists GET]', err);
        return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
    }
}
