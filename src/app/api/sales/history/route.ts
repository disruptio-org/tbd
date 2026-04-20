import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: runs, error } = await db
            .from('SalesGenerationRun')
            .select('id, taskType, title, inputPrompt, tone, buyerRole, prospectCompanyName, language, status, createdAt')
            .eq('companyId', auth.dbUser.companyId)
            .order('createdAt', { ascending: false })
            .limit(50);

        if (error) throw error;
        return NextResponse.json({ runs: runs || [] });
    } catch (err) {
        console.error('[/api/sales/history GET]', err);
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
        await db.from('SalesGenerationRun').delete().eq('id', id).eq('companyId', auth.dbUser.companyId);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[/api/sales/history DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
