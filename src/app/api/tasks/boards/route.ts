import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/tasks/boards — List boards for company
 * 
 * Query params:
 *   scope=global   → boards with projectId IS NULL
 *   projectId=<id> → boards for that project
 *   (none)         → all boards (backward compat)
 */
export async function GET(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const { searchParams } = request.nextUrl;
    const scope = searchParams.get('scope');
    const projectId = searchParams.get('projectId');

    let query = db
        .from('TaskBoard')
        .select('id, name, description, projectId, createdById, createdAt, updatedAt')
        .eq('companyId', auth.dbUser.companyId)
        .order('updatedAt', { ascending: false });

    // Apply scope filtering
    if (projectId) {
        query = query.eq('projectId', projectId);
    } else if (scope === 'global') {
        query = query.is('projectId', null);
    }
    // else: no filter → return all boards (backward compat)

    const { data: boards } = await query;

    if (!boards) return NextResponse.json({ boards: [] });

    // Enrich with column & task counts + project/customer info
    // Fetch all projects + customers for this company in bulk
    const { data: projects } = await db
        .from('Project')
        .select('id, name, customerId')
        .eq('companyId', auth.dbUser.companyId);

    const { data: customers } = await db
        .from('Customer')
        .select('id, name')
        .eq('companyId', auth.dbUser.companyId);

    const projectMap = new Map((projects || []).map(p => [p.id, p]));
    const customerMap = new Map((customers || []).map(c => [c.id, c]));

    const enriched = await Promise.all(
        boards.map(async (board) => {
            const { count: columnCount } = await db
                .from('TaskBoardColumn')
                .select('*', { count: 'exact', head: true })
                .eq('boardId', board.id);
            const { count: taskCount } = await db
                .from('Task')
                .select('*', { count: 'exact', head: true })
                .eq('boardId', board.id);

            const project = board.projectId ? projectMap.get(board.projectId) : null;
            const customer = project?.customerId ? customerMap.get(project.customerId) : null;

            return {
                ...board,
                columnCount: columnCount || 0,
                taskCount: taskCount || 0,
                projectName: project?.name || null,
                customerId: customer?.id || null,
                customerName: customer?.name || null,
            };
        })
    );

    return NextResponse.json({ boards: enriched });
}

/**
 * POST /api/tasks/boards — Create board with default columns
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, description, projectId } = await request.json();
        if (!name?.trim()) {
            return NextResponse.json({ error: 'Board name is required' }, { status: 400 });
        }

        const db = createAdminClient();

        // Validate projectId if provided
        if (projectId) {
            const { data: project } = await db
                .from('Project')
                .select('id')
                .eq('id', projectId)
                .eq('companyId', auth.dbUser.companyId)
                .maybeSingle();

            if (!project) {
                return NextResponse.json({ error: 'Project not found or not authorized' }, { status: 400 });
            }
        }

        const boardId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Create board
        await db.from('TaskBoard').insert({
            id: boardId,
            companyId: auth.dbUser.companyId,
            name: name.trim(),
            description: description?.trim() || null,
            projectId: projectId || null,
            createdById: auth.dbUser.id,
            updatedAt: now,
        });

        // Create 3 default columns
        const defaultColumns = [
            { id: crypto.randomUUID(), boardId, name: 'To Do', position: 0, isDefault: true, isDone: false },
            { id: crypto.randomUUID(), boardId, name: 'In Progress', position: 1, isDefault: false, isDone: false },
            { id: crypto.randomUUID(), boardId, name: 'Done', position: 2, isDefault: false, isDone: true },
        ];

        await db.from('TaskBoardColumn').insert(defaultColumns);

        return NextResponse.json({ board: { id: boardId, name: name.trim(), projectId: projectId || null, columns: defaultColumns } });
    } catch (error) {
        console.error('[tasks/boards] POST error:', error);
        return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
    }
}
