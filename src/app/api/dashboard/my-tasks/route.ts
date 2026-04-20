import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/dashboard/my-tasks
 * Returns open tasks assigned to the current user across all boards,
 * grouped by project card. Also includes a "this week" summary.
 */
export async function GET() {
    try {
        const auth = await getCurrentUser();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = createAdminClient();
        const userId = auth.dbUser.id;
        const companyId = auth.dbUser.companyId;

        // Get all "done" column IDs so we can exclude completed tasks
        const { data: doneColumns } = await db
            .from('TaskBoardColumn')
            .select('id, boardId')
            .eq('isDone', true);

        // Get boards for this company with project info
        const { data: companyBoards } = await db
            .from('TaskBoard')
            .select('id, name, projectId')
            .eq('companyId', companyId);

        if (!companyBoards || companyBoards.length === 0) {
            return NextResponse.json({ groups: [], thisWeek: { total: 0, completed: 0, tasks: [] } });
        }

        const boardMap = new Map(companyBoards.map(b => [b.id, b]));
        const boardIds = companyBoards.map(b => b.id);
        const doneColumnIds = (doneColumns || [])
            .filter(c => boardIds.includes(c.boardId))
            .map(c => c.id);

        // Get project names for boards linked to projects
        const projectIds = [...new Set(companyBoards.filter(b => b.projectId).map(b => b.projectId!))];
        const projectMap = new Map<string, string>();
        if (projectIds.length > 0) {
            const { data: projects } = await db
                .from('Project')
                .select('id, name')
                .in('id', projectIds);
            (projects || []).forEach(p => projectMap.set(p.id, p.name));
        }

        // Query tasks assigned to this user in company boards
        const { data: rawTasks } = await db
            .from('Task')
            .select('id, title, priority, dueDate, startDate, boardId, columnId, isCompleted, labels, createdAt')
            .eq('assigneeId', userId)
            .in('boardId', boardIds)
            .order('createdAt', { ascending: false });

        if (!rawTasks || rawTasks.length === 0) {
            return NextResponse.json({ groups: [], thisWeek: { total: 0, completed: 0, tasks: [] } });
        }

        // Filter out tasks in done columns or marked as completed
        const openTasks = rawTasks.filter(
            t => !t.isCompleted && !doneColumnIds.includes(t.columnId)
        );

        // Also get completed tasks this week for the progress bar
        const completedThisWeek = rawTasks.filter(
            t => t.isCompleted || doneColumnIds.includes(t.columnId)
        );

        // Get column names
        const allColumnIds = [...new Set([...openTasks, ...completedThisWeek].map(t => t.columnId))];
        const { data: columns } = await db
            .from('TaskBoardColumn')
            .select('id, name')
            .in('id', allColumnIds.length > 0 ? allColumnIds : ['__none__']);
        const columnMap = new Map((columns || []).map(c => [c.id, c.name]));

        // ──── "This Week" calculation ────────────────────────
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + mondayOffset);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const isThisWeek = (dateStr: string | null) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d >= weekStart && d <= weekEnd;
        };

        const thisWeekOpen = openTasks.filter(t => isThisWeek(t.dueDate));
        const thisWeekDone = completedThisWeek.filter(t => isThisWeek(t.dueDate));

        const thisWeekSummary = {
            total: thisWeekOpen.length + thisWeekDone.length,
            completed: thisWeekDone.length,
            tasks: thisWeekOpen.map(t => {
                const board = boardMap.get(t.boardId);
                return {
                    id: t.id,
                    title: t.title,
                    dueDate: t.dueDate,
                    priority: t.priority,
                    projectName: board?.projectId ? (projectMap.get(board.projectId) || null) : null,
                    boardName: board?.name || '',
                };
            }),
        };

        // ──── Sort & group open tasks ────────────────────────
        const priorityWeight: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        openTasks.sort((a, b) => {
            const pa = priorityWeight[a.priority] ?? 3;
            const pb = priorityWeight[b.priority] ?? 3;
            if (pa !== pb) return pa - pb;
            if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });

        // Group by board
        const groupsMap = new Map<string, {
            boardId: string;
            boardName: string;
            projectName: string | null;
            tasks: Array<{
                id: string;
                title: string;
                priority: string;
                dueDate: string | null;
                columnName: string;
                labels: string[];
            }>;
        }>();

        for (const task of openTasks) {
            const board = boardMap.get(task.boardId);
            if (!board) continue;

            if (!groupsMap.has(task.boardId)) {
                groupsMap.set(task.boardId, {
                    boardId: task.boardId,
                    boardName: board.name,
                    projectName: board.projectId ? (projectMap.get(board.projectId) || null) : null,
                    tasks: [],
                });
            }

            groupsMap.get(task.boardId)!.tasks.push({
                id: task.id,
                title: task.title,
                priority: task.priority,
                dueDate: task.dueDate,
                columnName: columnMap.get(task.columnId) || '',
                labels: task.labels || [],
            });
        }

        const groups = Array.from(groupsMap.values());

        return NextResponse.json({ groups, thisWeek: thisWeekSummary });
    } catch (error) {
        console.error('[dashboard/my-tasks] Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
