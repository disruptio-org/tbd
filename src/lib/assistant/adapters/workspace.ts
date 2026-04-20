/**
 * Workspace Launcher Adapter — builds deep links with prefilled state
 * for Boardroom, Tasks, and Knowledge workspaces.
 */
import type { ModuleAdapter, AdapterResult } from './types';

export interface WorkspaceResult extends AdapterResult {
    workspaceTarget?: string;
    workspaceState?: Record<string, unknown>;
}

const WORKSPACE_LABELS: Record<string, string> = {
    boardroom: 'Boardroom',
    tasks: 'Tasks',
    knowledge: 'Knowledge',
};

export const workspaceAdapter: ModuleAdapter = {
    name: 'workspace',
    requiredParams: ['workspaceTarget'],
    optionalParams: ['workspaceState'],

    async execute(params: Record<string, unknown>): Promise<WorkspaceResult> {
        const target = String(params.workspaceTarget || '').toLowerCase();
        const state = (params.workspaceState as Record<string, unknown>) || {};
        const label = WORKSPACE_LABELS[target];

        if (!label) {
            return {
                success: false,
                resultSummary: `Unknown workspace: ${target}`,
                error: 'UNKNOWN_WORKSPACE',
            };
        }

        let deepLink: string;

        switch (target) {
            case 'boardroom': {
                const q = new URLSearchParams();
                if (state.name) q.set('name', String(state.name));
                if (state.description) q.set('description', String(state.description));
                if (state.projectId) q.set('projectId', String(state.projectId));
                deepLink = `/boardroom${q.toString() ? '?' + q.toString() : ''}`;
                break;
            }

            case 'tasks': {
                const q = new URLSearchParams();
                if (state.boardId) q.set('board', String(state.boardId));
                if (state.draftTasks && Array.isArray(state.draftTasks)) {
                    q.set('draft', JSON.stringify(state.draftTasks));
                }
                deepLink = `/tasks${q.toString() ? '?' + q.toString() : ''}`;
                break;
            }

            case 'knowledge': {
                const q = new URLSearchParams();
                if (state.query) q.set('q', String(state.query));
                deepLink = `/knowledge${q.toString() ? '?' + q.toString() : ''}`;
                break;
            }

            default:
                deepLink = `/${target}`;
        }

        return {
            success: true,
            resultSummary: `Opening ${label} with your context ready.`,
            deepLink,
            workspaceTarget: target,
            workspaceState: state,
        };
    },
};
