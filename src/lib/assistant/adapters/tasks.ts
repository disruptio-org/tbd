/**
 * Task creation adapter.
 * Creates one or multiple tasks on the user's task board.
 * Supports both single task (title param) and batch creation (tasks array or titles list).
 *
 * REQUIRED context before execution:
 *   - boardId: Which board to create tasks on
 *   - title (or tasks[]): What tasks to create
 * OPTIONAL but prompted:
 *   - columnName: Which column to place tasks in (defaults to first column)
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { ModuleAdapter, AuthContext, AdapterResult } from './types';

interface TaskInput {
    title: string;
    description?: string;
    priority?: string;
}

/**
 * Parse the intent params into one or more task inputs.
 */
function parseTaskInputs(params: Record<string, unknown>): TaskInput[] {
    const results: TaskInput[] = [];

    // 1. Check for "tasks" array
    if (Array.isArray(params.tasks)) {
        for (const item of params.tasks) {
            if (typeof item === 'string' && item.trim()) {
                results.push({ title: item.trim() });
            } else if (typeof item === 'object' && item && 'title' in item) {
                const t = String((item as Record<string, unknown>).title || '').trim();
                if (t) results.push({
                    title: t,
                    description: (item as Record<string, unknown>).description ? String((item as Record<string, unknown>).description) : undefined,
                    priority: (item as Record<string, unknown>).priority ? String((item as Record<string, unknown>).priority) : undefined,
                });
            }
        }
        if (results.length > 0) return results;
    }

    // 2. Check for "titles" array
    if (Array.isArray(params.titles)) {
        for (const t of params.titles) {
            const s = String(t || '').trim();
            if (s) results.push({ title: s });
        }
        if (results.length > 0) return results;
    }

    // 3. Single title
    const title = String(params.title || '').trim();
    if (title) {
        return [{
            title,
            description: params.description ? String(params.description) : undefined,
            priority: params.priority ? String(params.priority) : undefined,
        }];
    }

    // 4. Fallback: parse from description
    const desc = String(params.description || '').trim();
    if (desc) {
        const lines = desc.split(/\s*[\n\r]+\s*/).map(s => s.trim()).filter(Boolean);
        if (lines.length > 0) {
            return lines.map(l => ({ title: l }));
        }
    }

    return [];
}

export const tasksAdapter: ModuleAdapter = {
    name: 'tasks',
    requiredParams: ['title', 'boardId'],
    optionalParams: ['description', 'projectId', 'priority', 'tasks', 'titles', 'columnName'],

    async execute(params: Record<string, unknown>, auth: AuthContext): Promise<AdapterResult> {
        const db = createAdminClient();
        const taskInputs = parseTaskInputs(params);

        if (taskInputs.length === 0) {
            return { success: false, resultSummary: 'Task title is required', error: 'Could not extract task title(s) from the request' };
        }

        const boardId = params.boardId ? String(params.boardId) : null;

        // ── If no boardId, return available boards so the orchestrator can ask ──
        if (!boardId) {
            const { data: boards } = await db
                .from('TaskBoard')
                .select('id, name, projectId')
                .eq('companyId', auth.companyId)
                .order('updatedAt', { ascending: false });

            if (!boards || boards.length === 0) {
                return { success: false, resultSummary: 'No task boards found. Create a board in Tasks first.', error: 'No boards' };
            }

            // Get project names
            const pIds = [...new Set(boards.filter(b => b.projectId).map(b => b.projectId!))];
            let projectNames: Record<string, string> = {};
            if (pIds.length > 0) {
                const { data: projects } = await db.from('Project').select('id, name').in('id', pIds);
                projectNames = Object.fromEntries((projects || []).map(p => [p.id, p.name]));
            }

            const boardList = boards.map(b => {
                const pName = b.projectId ? projectNames[b.projectId] : null;
                return pName ? `${pName} / ${b.name} (ID: ${b.id})` : `${b.name} (ID: ${b.id})`;
            });

            return {
                success: false,
                resultSummary: `Which board should I create the task(s) on?\n\nAvailable boards:\n${boardList.map(b => `• ${b}`).join('\n')}`,
                error: '__NEEDS_BOARD__',
            };
        }

        // ── Board exists, resolve column ──
        const { data: columns } = await db
            .from('TaskBoardColumn')
            .select('id, name, isDone')
            .eq('boardId', boardId)
            .order('position', { ascending: true });

        if (!columns || columns.length === 0) {
            return { success: false, resultSummary: 'No columns found on the selected board.', error: 'No columns' };
        }

        // If columnName provided, match it; otherwise use first non-done column
        let targetColumn = columns[0];
        const requestedColumn = params.columnName ? String(params.columnName).trim().toLowerCase() : null;

        if (requestedColumn) {
            const match = columns.find(c => c.name.toLowerCase() === requestedColumn);
            if (match) {
                targetColumn = match;
            }
            // fallback to first column if no match
        } else {
            // Default to first non-done column
            const nonDone = columns.find(c => !c.isDone);
            if (nonDone) targetColumn = nonDone;
        }

        const projectId = params.projectId ? String(params.projectId) : null;

        // Get current max position in column
        const { data: maxTasks } = await db
            .from('Task')
            .select('position')
            .eq('columnId', targetColumn.id)
            .order('position', { ascending: false })
            .limit(1);

        let nextPosition = (maxTasks?.length ? maxTasks[0].position : -1) + 1;
        const createdTitles: string[] = [];

        // Create each task
        for (const input of taskInputs) {
            const taskId = crypto.randomUUID();

            await db.from('Task').insert({
                id: taskId,
                companyId: auth.companyId,
                boardId,
                columnId: targetColumn.id,
                projectId,
                title: input.title,
                description: input.description || null,
                priority: input.priority || 'medium',
                position: nextPosition++,
                reporterId: auth.userId,
                sourceType: 'ACTION_ASSISTANT',
                updatedAt: new Date().toISOString(),
            });

            await db.from('TaskActivity').insert({
                id: crypto.randomUUID(),
                taskId,
                actorId: auth.userId,
                action: 'created',
                metadata: { title: input.title, source: 'action_assistant' },
            });

            createdTitles.push(input.title);
        }

        const summary = createdTitles.length === 1
            ? `Task created: "${createdTitles[0]}" in ${targetColumn.name}`
            : `${createdTitles.length} tasks created in "${targetColumn.name}":\n${createdTitles.map(t => `• ${t}`).join('\n')}`;

        return {
            success: true,
            resultSummary: summary,
            deepLink: `/tasks?boardId=${boardId}`,
        };
    },
};
