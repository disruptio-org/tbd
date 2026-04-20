import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/documents/folders
 * List all folders for the current company.
 */
export async function GET() {
    try {
        const auth = await getCurrentUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = createAdminClient();
        const { data } = await db
            .from('DocFolder')
            .select('*')
            .eq('companyId', auth.dbUser.companyId)
            .order('name', { ascending: true });

        return NextResponse.json(data ?? []);
    } catch (error) {
        console.error('[folders GET]', error);
        return NextResponse.json([], { status: 500 });
    }
}

/**
 * POST /api/documents/folders
 * Create a new folder.
 */
export async function POST(req: Request) {
    try {
        const auth = await getCurrentUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { name, parentId } = await req.json();
        if (!name?.trim()) {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const { data, error } = await db.from('DocFolder').insert({
            id: crypto.randomUUID(),
            companyId: auth.dbUser.companyId,
            name: name.trim(),
            parentId: parentId || null,
        }).select().single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('[folders POST]', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
