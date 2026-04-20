import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/product/history — List past generation runs.
 * DELETE /api/product/history — Delete a generation run by id.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: runs, error } = await db
            .from('ProductGenerationRun')
            .select('id, outputType, title, inputPrompt, audienceType, detailLevel, status, createdAt')
            .eq('companyId', auth.dbUser.companyId)
            .order('createdAt', { ascending: false })
            .limit(50);

        if (error) throw error;
        return NextResponse.json({ runs: runs || [] });
    } catch (err) {
        console.error('[/api/product/history GET]', err);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const db = createAdminClient();
        await db
            .from('ProductGenerationRun')
            .delete()
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/product/history DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
