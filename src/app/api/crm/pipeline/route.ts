import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/crm/pipeline — List all pipeline stages for the company
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();

    const { data: stages, error } = await db
        .from('CrmPipelineStage')
        .select('*')
        .eq('companyId', auth.dbUser.companyId)
        .eq('isArchived', false)
        .order('position', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch pipeline stages' }, { status: 500 });
    }

    return NextResponse.json({ stages: stages || [] });
}

/**
 * PUT /api/crm/pipeline — Update pipeline stages (admin only)
 * Body: { stages: [{ id?, name, position, color, isDefault }] }
 */
export async function PUT(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin-only check
    if (auth.dbUser.role !== 'ADMIN' && auth.dbUser.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only admins can configure the pipeline' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { stages } = body;
        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        if (!Array.isArray(stages) || stages.length === 0) {
            return NextResponse.json({ error: 'stages array is required' }, { status: 400 });
        }

        const now = new Date().toISOString();

        // Process each stage: update existing or create new
        for (const stage of stages) {
            if (stage.id) {
                // Update existing
                await db
                    .from('CrmPipelineStage')
                    .update({
                        name: stage.name,
                        position: stage.position,
                        color: stage.color || null,
                        isDefault: stage.isDefault || false,
                        isArchived: stage.isArchived || false,
                        updatedAt: now,
                    })
                    .eq('id', stage.id)
                    .eq('companyId', companyId);
            } else {
                // Create new
                await db.from('CrmPipelineStage').insert({
                    id: crypto.randomUUID(),
                    companyId,
                    name: stage.name,
                    position: stage.position,
                    color: stage.color || null,
                    isDefault: stage.isDefault || false,
                    isArchived: false,
                    updatedAt: now,
                });
            }
        }

        // Fetch updated stages
        const { data: updatedStages } = await db
            .from('CrmPipelineStage')
            .select('*')
            .eq('companyId', companyId)
            .eq('isArchived', false)
            .order('position', { ascending: true });

        return NextResponse.json({ stages: updatedStages || [] });
    } catch (err) {
        console.error('[CRM Pipeline PUT] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/crm/pipeline — Seed default stages for a company
 */
export async function POST() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (auth.dbUser.role !== 'ADMIN' && auth.dbUser.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only admins can configure the pipeline' }, { status: 403 });
    }

    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Check if stages already exist
    const { data: existing } = await db
        .from('CrmPipelineStage')
        .select('id')
        .eq('companyId', companyId)
        .limit(1);

    if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'Pipeline stages already exist for this company' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const defaultStages = [
        { name: 'New Lead', position: 0, color: '#3B82F6', isDefault: true },
        { name: 'Contacted', position: 1, color: '#8B5CF6', isDefault: false },
        { name: 'Qualified', position: 2, color: '#F59E0B', isDefault: false },
        { name: 'Proposal', position: 3, color: '#F97316', isDefault: false },
        { name: 'Customer', position: 4, color: '#10B981', isDefault: false },
        { name: 'Lost', position: 5, color: '#EF4444', isDefault: false },
    ];

    const rows = defaultStages.map(s => ({
        id: crypto.randomUUID(),
        companyId,
        ...s,
        isArchived: false,
        updatedAt: now,
    }));

    const { error } = await db.from('CrmPipelineStage').insert(rows);

    if (error) {
        console.error('[CRM Pipeline POST] Error:', error);
        return NextResponse.json({ error: 'Failed to create default stages' }, { status: 500 });
    }

    return NextResponse.json({ stages: rows }, { status: 201 });
}
