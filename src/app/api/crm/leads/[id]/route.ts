import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/crm/leads/[id] — Full lead detail with contacts + recent activities
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    const { data: lead, error } = await db
        .from('CrmLead')
        .select('*, pipelineStage:CrmPipelineStage(id, name, color, position), owner:User!CrmLead_ownerUserId_fkey(id, name, email, avatarUrl), createdBy:User!CrmLead_createdByUserId_fkey(id, name, email)')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (error || !lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Fetch contacts
    const { data: contacts } = await db
        .from('CrmLeadContact')
        .select('*')
        .eq('crmLeadId', id)
        .order('isPrimary', { ascending: false });

    // Fetch recent activities (last 50)
    const { data: activities } = await db
        .from('CrmLeadActivity')
        .select('*, actor:User!CrmLeadActivity_actorId_fkey(id, name, avatarUrl)')
        .eq('crmLeadId', id)
        .order('createdAt', { ascending: false })
        .limit(50);

    return NextResponse.json({ lead, contacts: contacts || [], activities: activities || [] });
}

/**
 * PUT /api/crm/leads/[id] — Update lead fields
 * Auto-logs stage changes, owner changes, and lifecycle transitions
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;
    const userId = auth.dbUser.id;

    try {
        const body = await req.json();

        // Fetch current lead for comparison
        const { data: current } = await db
            .from('CrmLead')
            .select('*, pipelineStage:CrmPipelineStage(id, name)')
            .eq('id', id)
            .eq('companyId', companyId)
            .maybeSingle();

        if (!current) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const now = new Date().toISOString();
        const updates: Record<string, unknown> = { updatedAt: now };
        const activityLogs: { action: string; content: string; metadata?: Record<string, unknown> }[] = [];

        // Map allowed fields
        const allowedFields = ['leadName', 'companyName', 'email', 'phone', 'jobTitle', 'website', 'industry', 'location', 'notes', 'tags'];
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        // Stage change
        if (body.pipelineStageId && body.pipelineStageId !== current.pipelineStageId) {
            const { data: newStage } = await db
                .from('CrmPipelineStage')
                .select('id, name')
                .eq('id', body.pipelineStageId)
                .eq('companyId', companyId)
                .maybeSingle();

            if (!newStage) {
                return NextResponse.json({ error: 'Invalid pipeline stage' }, { status: 400 });
            }

            updates.pipelineStageId = body.pipelineStageId;
            updates.lastActivityAt = now;
            activityLogs.push({
                action: 'stage_changed',
                content: `Stage changed from "${current.pipelineStage?.name}" to "${newStage.name}"`,
                metadata: { from: current.pipelineStageId, to: body.pipelineStageId, fromName: current.pipelineStage?.name, toName: newStage.name },
            });
        }

        // Owner change
        if (body.ownerUserId !== undefined && body.ownerUserId !== current.ownerUserId) {
            updates.ownerUserId = body.ownerUserId || null;
            updates.lastActivityAt = now;

            let ownerName = 'Unassigned';
            if (body.ownerUserId) {
                const { data: newOwner } = await db.from('User').select('name').eq('id', body.ownerUserId).maybeSingle();
                ownerName = newOwner?.name || 'Unknown';
            }

            activityLogs.push({
                action: 'owner_changed',
                content: `Owner changed to ${ownerName}`,
                metadata: { from: current.ownerUserId, to: body.ownerUserId },
            });
        }

        // Lifecycle status change
        if (body.lifecycleStatus && body.lifecycleStatus !== current.lifecycleStatus) {
            updates.lifecycleStatus = body.lifecycleStatus;
            updates.lastActivityAt = now;

            if (body.lifecycleStatus === 'CONVERTED') {
                updates.convertedAt = now;
                activityLogs.push({ action: 'converted', content: 'Lead converted to customer' });
            } else if (body.lifecycleStatus === 'LOST') {
                updates.lostReason = body.lostReason || null;
                activityLogs.push({ action: 'lost', content: `Lead marked as lost${body.lostReason ? `: ${body.lostReason}` : ''}` });
            } else if (body.lifecycleStatus === 'ARCHIVED') {
                updates.archivedAt = now;
                activityLogs.push({ action: 'updated', content: 'Lead archived' });
            }
        }

        // Perform the update
        const { data: updated, error } = await db
            .from('CrmLead')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[CRM Lead PUT] Error:', error);
            return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
        }

        // Log activities
        if (activityLogs.length > 0) {
            const activities = activityLogs.map(log => ({
                id: crypto.randomUUID(),
                crmLeadId: id,
                actorId: userId,
                action: log.action,
                content: log.content,
                metadata: log.metadata || null,
            }));
            await db.from('CrmLeadActivity').insert(activities);
        }

        return NextResponse.json({ lead: updated });
    } catch (err) {
        console.error('[CRM Lead PUT] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/crm/leads/[id] — Soft archive a lead
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    const now = new Date().toISOString();

    const { error } = await db
        .from('CrmLead')
        .update({ lifecycleStatus: 'ARCHIVED', archivedAt: now, updatedAt: now })
        .eq('id', id)
        .eq('companyId', companyId);

    if (error) {
        return NextResponse.json({ error: 'Failed to archive lead' }, { status: 500 });
    }

    // Log archive activity
    await db.from('CrmLeadActivity').insert({
        id: crypto.randomUUID(),
        crmLeadId: id,
        actorId: auth.dbUser.id,
        action: 'updated',
        content: 'Lead archived',
    });

    return NextResponse.json({ success: true });
}
