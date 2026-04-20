import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/tasks/boards/[id]/columns/reorder — Batch reorder columns
 * Body: { columnIds: string[] } — ordered array of column IDs
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: boardId } = await params;
    const db = createAdminClient();

    // Verify board ownership
    const { data: board } = await db
        .from('TaskBoard')
        .select('id')
        .eq('id', boardId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

    try {
        const { columnIds } = await request.json();
        if (!Array.isArray(columnIds) || columnIds.length === 0) {
            return NextResponse.json({ error: 'columnIds array is required' }, { status: 400 });
        }

        // Update each column position
        await Promise.all(
            columnIds.map((colId: string, index: number) =>
                db.from('TaskBoardColumn')
                    .update({ position: index })
                    .eq('id', colId)
                    .eq('boardId', boardId)
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[columns/reorder] POST error:', error);
        return NextResponse.json({ error: 'Failed to reorder columns' }, { status: 500 });
    }
}
