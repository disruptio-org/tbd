import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/classifications/[id]
 * Get a single classification type with its results.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const db = createAdminClient();

        const { data, error } = await db
            .from('ClassificationType')
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Fetch associated results
        const { data: results } = await db
            .from('ClassificationResult')
            .select('*, document:documentId(id, filename, mimeType)')
            .eq('classificationTypeId', id)
            .order('createdAt', { ascending: false });

        return NextResponse.json({ ...data, results: results ?? [] });
    } catch (err) {
        console.error('[classifications/[id] GET]', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

/**
 * PUT /api/classifications/[id]
 * Update a classification type.
 * Body: { name?, description?, aiPrompt?, fieldDefinitions? }
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const db = createAdminClient();

        // Verify ownership
        const { data: existing } = await db
            .from('ClassificationType')
            .select('id')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if (body.name !== undefined) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.aiPrompt !== undefined) updates.aiPrompt = body.aiPrompt;
        if (body.fieldDefinitions !== undefined) updates.fieldDefinitions = body.fieldDefinitions;

        const { data, error } = await db
            .from('ClassificationType')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (err) {
        console.error('[classifications/[id] PUT]', err);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

/**
 * DELETE /api/classifications/[id]
 * Delete a classification type and its results/history.
 */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const db = createAdminClient();

        // Verify ownership
        const { data: existing } = await db
            .from('ClassificationType')
            .select('id')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Delete history, results, then type
        await db.from('ClassificationHistory').delete().eq('classificationTypeId', id);
        await db.from('ClassificationResult').delete().eq('classificationTypeId', id);
        await db.from('ClassificationType').delete().eq('id', id);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[classifications/[id] DELETE]', err);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
