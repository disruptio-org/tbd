import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { taskType, title, content, metadata } = await request.json();
        if (!title?.trim() || !content?.trim()) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
        }

        const db = createAdminClient();
        const id = crypto.randomUUID();

        await db.from('SalesDraft').insert({
            id,
            companyId: auth.dbUser.companyId,
            userId: auth.dbUser.id,
            taskType: taskType || 'GENERAL',
            title: title.trim(),
            content,
            metadata: metadata || null,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ id, success: true });
    } catch (err) {
        console.error('[/api/sales/drafts POST]', err);
        return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }
}

export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: drafts, error } = await db
            .from('SalesDraft')
            .select('id, taskType, title, createdAt, updatedAt')
            .eq('companyId', auth.dbUser.companyId)
            .order('updatedAt', { ascending: false })
            .limit(50);

        if (error) throw error;
        return NextResponse.json({ drafts: drafts || [] });
    } catch (err) {
        console.error('[/api/sales/drafts GET]', err);
        return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }
}
