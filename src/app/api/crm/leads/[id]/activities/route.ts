import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/crm/leads/[id]/activities — Paginated activity timeline
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    // Verify lead belongs to company
    const { data: lead } = await db
        .from('CrmLead')
        .select('id')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const { data: activities, error } = await db
        .from('CrmLeadActivity')
        .select('*, actor:User!CrmLeadActivity_actorId_fkey(id, name, avatarUrl)')
        .eq('crmLeadId', id)
        .order('createdAt', { ascending: false })
        .limit(100);

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }

    return NextResponse.json({ activities: activities || [] });
}

/**
 * POST /api/crm/leads/[id]/activities — Add a note or manual activity
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();
    const userId = auth.dbUser.id;

    try {
        const body = await req.json();
        const { content, action } = body;

        if (!content?.trim()) {
            return NextResponse.json({ error: 'content is required' }, { status: 400 });
        }

        // Verify lead belongs to company
        const { data: lead } = await db
            .from('CrmLead')
            .select('id')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

        const activityId = crypto.randomUUID();
        const { data: activity, error } = await db
            .from('CrmLeadActivity')
            .insert({
                id: activityId,
                crmLeadId: id,
                actorId: userId,
                action: action || 'note_added',
                content: content.trim(),
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: 'Failed to add activity' }, { status: 500 });
        }

        // Update lead's lastActivityAt
        await db.from('CrmLead').update({ lastActivityAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq('id', id);

        return NextResponse.json({ activity }, { status: 201 });
    } catch (err) {
        console.error('[CRM Activities POST] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
