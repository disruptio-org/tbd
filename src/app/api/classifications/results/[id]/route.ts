import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/classifications/results/[id]
 * Get a classification result by ID.
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
            .from('ClassificationResult')
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Fetch related document and type
        const { data: doc } = await db
            .from('Document')
            .select('id, filename, mimeType')
            .eq('id', data.documentId)
            .single();

        const { data: classType } = await db
            .from('ClassificationType')
            .select('id, name, fieldDefinitions')
            .eq('id', data.classificationTypeId)
            .single();

        return NextResponse.json({
            ...data,
            document: doc,
            classificationType: classType,
        });
    } catch (err) {
        console.error('[classifications/results/[id] GET]', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

/**
 * PUT /api/classifications/results/[id]
 * Update extracted fields (user corrections) and optionally add feedback.
 * Body: { extractedFields?, feedback? }
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
            .from('ClassificationResult')
            .select('id, classificationTypeId')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Update extracted fields if provided
        if (body.extractedFields) {
            await db
                .from('ClassificationResult')
                .update({ extractedFields: body.extractedFields })
                .eq('id', id);
        }

        // Log feedback if provided
        if (body.feedback) {
            await db.from('ClassificationHistory').insert({
                id: crypto.randomUUID(),
                companyId: auth.dbUser.companyId,
                userId: auth.dbUser.id,
                classificationTypeId: existing.classificationTypeId,
                classificationResultId: id,
                action: 'feedback',
                feedback: body.feedback,
            });
        }

        const { data } = await db
            .from('ClassificationResult')
            .select('*')
            .eq('id', id)
            .single();

        return NextResponse.json(data);
    } catch (err) {
        console.error('[classifications/results/[id] PUT]', err);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
