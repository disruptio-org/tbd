/**
 * Orchestrator V2 — Command Router for the Action Assistant.
 *
 * Three execution modes:
 *   1. DIRECT  — Execute immediately (tasks, navigation, initiative)
 *   2. HANDOFF — Route to an AI team member with context
 *   3. WORKSPACE — Launch a workspace with prefilled state
 *
 * State machine: classify → (intake?) → route → execute/handoff/launch
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyIntent, type ClassifiedIntent } from './intent-classifier';
import { parseStructuredIntake, type StructuredIntakeResult } from './structured-intake';
import {
    tasksAdapter,
    navigationAdapter,
    initiativeAdapter,
    handoffAdapter,
    workspaceAdapter,
    type ModuleAdapter,
    type AuthContext,
    type AdapterResult,
} from './adapters';

// ─── Types ────────────────────────────────────────────

export type { AuthContext } from './adapters';

export interface OrchestratorRequest {
    sessionId?: string;
    message: string;
    inputMode: 'TEXT' | 'VOICE';
    pageContext: {
        route: string;
        objectId?: string;
        objectType?: string;
        pageTitle?: string;
    };
    respondingToActionId?: string;
    confirmAction?: boolean;
    /**
     * When set, the request is coming from an AI Team Member chat.
     * V2 routing is bypassed — handoff/workspace intents are suppressed.
     */
    memberContext?: {
        memberId: string;
        brainType: string;
    };
}

export interface OrchestratorResponse {
    sessionId: string;
    assistantMessage: string;
    actionRun?: {
        id: string;
        status: string;
        interpretation: string;
        intentType?: string;
        executionMode?: 'direct' | 'handoff' | 'workspace';
        // Clarification
        clarificationQuestion?: string;
        clarificationOptions?: string[];
        missingParams?: string[];
        // Confirmation
        confirmationSummary?: string;
        // Direct result
        resultSummary?: string;
        deepLink?: string;
        inlinePreview?: string;
        groundingStatus?: string;
        // Handoff
        handoffTarget?: string;
        handoffMemberName?: string;
        handoffMemberId?: string;
        handoffDeepLink?: string;
        prefilledPrompt?: string;
        // Workspace
        workspaceTarget?: string;
        workspaceDeepLink?: string;
        workspaceState?: Record<string, unknown>;
        // Intake preview
        intakePreview?: StructuredIntakeResult;
    };
}

// ─── Direct Action Adapters ───────────────────────────

const DIRECT_ADAPTERS: Record<string, ModuleAdapter> = {
    create_task: tasksAdapter,
    create_tasks_from_notes: tasksAdapter,
    navigate: navigationAdapter,
    open_initiative: initiativeAdapter,
    summarize_to_actions: tasksAdapter, // uses tasks adapter to create action items
};

// ─── RBAC ─────────────────────────────────────────────

const ROLE_REQUIREMENTS: Record<string, string[]> = {
    create_task: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    create_tasks_from_notes: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    navigate: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    open_initiative: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    summarize_to_actions: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    route_to_marketing: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    route_to_product: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    route_to_sales: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    route_to_knowledge: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    open_boardroom: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    open_tasks_board: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
    open_knowledge_view: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
};

function checkPermission(intentType: string, role: string): boolean {
    const allowed = ROLE_REQUIREMENTS[intentType] || ['ADMIN', 'SUPER_ADMIN'];
    return allowed.includes(role);
}

// ─── Helper: fetch boards+columns ─────────────────────

async function fetchAvailableBoards(
    db: ReturnType<typeof createAdminClient>,
    companyId: string,
): Promise<Array<{ id: string; boardName: string; projectName?: string; columns: string[] }>> {
    const { data: boards } = await db
        .from('TaskBoard')
        .select('id, name, projectId')
        .eq('companyId', companyId);
    if (!boards || boards.length === 0) return [];

    const pIds = [...new Set(boards.filter(b => b.projectId).map(b => b.projectId!))];
    const projectNames: Record<string, string> = {};
    if (pIds.length > 0) {
        const { data: projects } = await db.from('Project').select('id, name').in('id', pIds);
        (projects || []).forEach(p => { projectNames[p.id] = p.name; });
    }

    const boardIds = boards.map(b => b.id);
    const { data: allCols } = await db
        .from('TaskBoardColumn')
        .select('id, name, boardId, isDone')
        .in('boardId', boardIds)
        .order('position', { ascending: true });

    const colsByBoard: Record<string, string[]> = {};
    (allCols || []).forEach(c => {
        if (!colsByBoard[c.boardId]) colsByBoard[c.boardId] = [];
        colsByBoard[c.boardId].push(c.name);
    });

    return boards.map(b => ({
        id: b.id,
        boardName: b.name,
        projectName: b.projectId ? projectNames[b.projectId] : undefined,
        columns: colsByBoard[b.id] || [],
    }));
}

// ─── Main Orchestrator ────────────────────────────────

export async function orchestrate(
    req: OrchestratorRequest,
    auth: AuthContext,
): Promise<OrchestratorResponse> {
    const db = createAdminClient();

    // 0. Resolve project scope
    const resolvedProjectId = auth.projectId
        || (req.pageContext.objectType === 'project' ? req.pageContext.objectId : undefined);
    let resolvedProjectName: string | undefined;
    if (resolvedProjectId) {
        const { data: proj } = await db.from('Project').select('name').eq('id', resolvedProjectId).maybeSingle();
        resolvedProjectName = proj?.name || undefined;
    }
    const scopedAuth: AuthContext = resolvedProjectId ? { ...auth, projectId: resolvedProjectId } : auth;

    // 1. Session management
    let sessionId = req.sessionId;
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        await db.from('AssistantSession').insert({
            id: sessionId,
            userId: auth.userId,
            companyId: auth.companyId,
            currentRoute: req.pageContext.route,
            currentContextJson: req.pageContext,
            status: 'ACTIVE',
        });
    }

    // 2. Save user message
    await db.from('AssistantMessage').insert({
        id: crypto.randomUUID(),
        sessionId,
        role: 'USER',
        content: req.message,
        inputMode: req.inputMode,
    });

    // 3. Handle confirmation response
    if (req.respondingToActionId && req.confirmAction !== undefined) {
        return handleConfirmation(db, sessionId, req.respondingToActionId, req.confirmAction, scopedAuth);
    }

    // 4. Handle clarification response
    if (req.respondingToActionId) {
        return handleClarificationResponse(db, sessionId, req, scopedAuth);
    }

    // 5. Fetch boards for task matching
    const availableBoards = await fetchAvailableBoards(db, auth.companyId);

    // 6. Classify intent (V2)
    const companyName = await getCompanyName(db, auth.companyId);
    const conversationHistory = await getRecentMessages(db, sessionId);

    const intent = await classifyIntent({
        userMessage: req.message,
        currentRoute: req.pageContext.route,
        pageContext: req.pageContext as Record<string, unknown>,
        userRole: auth.role,
        companyName,
        conversationHistory,
        availableBoards,
        projectId: resolvedProjectId,
        projectName: resolvedProjectName,
    });

    // 6b. Member context bypass: prevent routing when already in a team member chat
    //     When inside a team member's conversation, the member's own chat pipeline handles
    //     content generation. The command router should NOT create tasks, open workspaces,
    //     or hand off — only navigation is allowed through.
    if (req.memberContext) {
        const isNavigation = intent.intentType === 'navigate';
        if (!isNavigation) {
            // Pass the message through to the member's own pipeline
            const msg = intent.prefilledPrompt || intent.interpretation || req.message;
            await saveAssistantMessage(db, sessionId, msg);
            return { sessionId, assistantMessage: msg };
        }
    }

    // 7. RBAC check
    if (!checkPermission(intent.intentType, auth.role)) {
        const msg = `I can't perform that action — it requires higher permissions.`;
        await saveAssistantMessage(db, sessionId, msg);
        return { sessionId, assistantMessage: msg };
    }

    // 8. Structured Intake gate — for notes/mixed input
    if (intent.inputType === 'notes' || intent.inputType === 'mixed') {
        const intake = await parseStructuredIntake(req.message);
        if (intake && intake.extractedTasks.length > 0) {
            return handleIntakePreview(db, sessionId, intent, intake, scopedAuth);
        }
    }

    // 9. Route based on execution mode
    switch (intent.executionMode) {
        case 'direct':
            return handleDirectExecution(db, sessionId, intent, scopedAuth, availableBoards);
        case 'handoff':
            return handleHandoff(db, sessionId, intent, scopedAuth);
        case 'workspace':
            return handleWorkspaceLaunch(db, sessionId, intent, scopedAuth);
        default:
            return handleDirectExecution(db, sessionId, intent, scopedAuth, availableBoards);
    }
}

// ─── Direct Execution ─────────────────────────────────

async function handleDirectExecution(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    intent: ClassifiedIntent,
    auth: AuthContext,
    availableBoards: Array<{ id: string; boardName: string; projectName?: string; columns: string[] }>,
): Promise<OrchestratorResponse> {
    // Missing params → clarification
    if (intent.missingParams.length > 0 || intent.confidence < 0.5) {
        return handleClarification(db, sessionId, intent, auth, availableBoards);
    }

    // Needs confirmation
    if (intent.requiresConfirmation || intent.confidence < 0.7) {
        return handleConfirmationRequest(db, sessionId, intent, auth);
    }

    // Execute
    return executeAction(db, sessionId, intent, auth);
}

// ─── Handoff to AI Team Member ────────────────────────

async function handleHandoff(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    intent: ClassifiedIntent,
    auth: AuthContext,
): Promise<OrchestratorResponse> {
    const actionId = crypto.randomUUID();

    // Execute the handoff adapter
    const result = await handoffAdapter.execute({
        intentType: intent.intentType,
        prefilledPrompt: intent.prefilledPrompt || intent.extractedParams.query || '',
        projectId: auth.projectId || intent.extractedParams.projectId,
    }, auth) as AdapterResult & {
        handoffMemberId?: string;
        handoffMemberName?: string;
        handoffBrainType?: string;
        prefilledPrompt?: string;
    };

    const status = result.success ? 'ROUTED' : 'FAILED';

    await db.from('AssistantActionRun').insert({
        id: actionId,
        sessionId,
        companyId: auth.companyId,
        userId: auth.userId,
        intentType: intent.intentType,
        targetModule: 'handoff',
        targetAction: intent.handoffTarget || '',
        confidenceScore: intent.confidence,
        requiresConfirmation: false,
        status,
        requestPayloadJson: intent.extractedParams,
        resultPayloadJson: result as unknown as Record<string, unknown>,
        resultLink: result.deepLink || null,
        updatedAt: new Date().toISOString(),
    });

    const msg = result.success
        ? `↗ ${result.resultSummary}`
        : `✗ ${result.resultSummary}`;
    await saveAssistantMessage(db, sessionId, msg);

    return {
        sessionId,
        assistantMessage: msg,
        actionRun: {
            id: actionId,
            status,
            interpretation: intent.interpretation,
            intentType: intent.intentType,
            executionMode: 'handoff',
            handoffTarget: intent.handoffTarget,
            handoffMemberName: result.handoffMemberName,
            handoffMemberId: result.handoffMemberId,
            handoffDeepLink: result.deepLink,
            prefilledPrompt: result.prefilledPrompt,
            deepLink: result.deepLink,
            resultSummary: result.resultSummary,
        },
    };
}

// ─── Workspace Launch ─────────────────────────────────

async function handleWorkspaceLaunch(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    intent: ClassifiedIntent,
    auth: AuthContext,
): Promise<OrchestratorResponse> {
    const actionId = crypto.randomUUID();

    const result = await workspaceAdapter.execute({
        workspaceTarget: intent.workspaceTarget,
        workspaceState: intent.workspaceState || intent.extractedParams,
    }, auth) as AdapterResult & {
        workspaceTarget?: string;
        workspaceState?: Record<string, unknown>;
    };

    const status = result.success ? 'WORKSPACE_LAUNCHED' : 'FAILED';

    await db.from('AssistantActionRun').insert({
        id: actionId,
        sessionId,
        companyId: auth.companyId,
        userId: auth.userId,
        intentType: intent.intentType,
        targetModule: 'workspace',
        targetAction: intent.workspaceTarget || '',
        confidenceScore: intent.confidence,
        requiresConfirmation: false,
        status,
        requestPayloadJson: intent.extractedParams,
        resultPayloadJson: result as unknown as Record<string, unknown>,
        resultLink: result.deepLink || null,
        updatedAt: new Date().toISOString(),
    });

    const msg = result.success
        ? `🚀 ${result.resultSummary}`
        : `✗ ${result.resultSummary}`;
    await saveAssistantMessage(db, sessionId, msg);

    return {
        sessionId,
        assistantMessage: msg,
        actionRun: {
            id: actionId,
            status,
            interpretation: intent.interpretation,
            intentType: intent.intentType,
            executionMode: 'workspace',
            workspaceTarget: result.workspaceTarget,
            workspaceDeepLink: result.deepLink,
            workspaceState: result.workspaceState,
            deepLink: result.deepLink,
            resultSummary: result.resultSummary,
        },
    };
}

// ─── Structured Intake Preview ────────────────────────

async function handleIntakePreview(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    intent: ClassifiedIntent,
    intake: StructuredIntakeResult,
    auth: AuthContext,
): Promise<OrchestratorResponse> {
    const actionId = crypto.randomUUID();

    // Merge intake results into extractedParams
    const mergedParams = {
        ...intent.extractedParams,
        tasks: intake.extractedTasks,
        decisions: intake.extractedDecisions,
        owners: intake.extractedOwners,
        deadlines: intake.extractedDeadlines,
        inferredProject: intake.inferredProject,
    };

    await db.from('AssistantActionRun').insert({
        id: actionId,
        sessionId,
        companyId: auth.companyId,
        userId: auth.userId,
        intentType: 'create_tasks_from_notes',
        targetModule: 'tasks',
        targetAction: 'create_from_notes',
        confidenceScore: intent.confidence,
        requiresConfirmation: true,
        status: 'INTAKE_PREVIEW',
        requestPayloadJson: mergedParams,
        updatedAt: new Date().toISOString(),
    });

    const taskCount = intake.extractedTasks.length;
    const decisionCount = intake.extractedDecisions.length;
    let msg = `I found **${taskCount} task${taskCount !== 1 ? 's' : ''}**`;
    if (decisionCount > 0) msg += ` and **${decisionCount} decision${decisionCount !== 1 ? 's' : ''}**`;
    msg += `. Review and confirm?`;

    await saveAssistantMessage(db, sessionId, msg);

    return {
        sessionId,
        assistantMessage: msg,
        actionRun: {
            id: actionId,
            status: 'INTAKE_PREVIEW',
            interpretation: intent.interpretation,
            intentType: 'create_tasks_from_notes',
            executionMode: 'direct',
            confirmationSummary: msg,
            intakePreview: intake,
        },
    };
}

// ─── Clarification ────────────────────────────────────

async function handleClarification(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    intent: ClassifiedIntent,
    auth: AuthContext,
    availableBoards?: Array<{ id: string; boardName: string; projectName?: string; columns: string[] }>,
): Promise<OrchestratorResponse> {
    const actionId = crypto.randomUUID();

    await db.from('AssistantActionRun').insert({
        id: actionId,
        sessionId,
        companyId: auth.companyId,
        userId: auth.userId,
        intentType: intent.intentType,
        targetModule: 'tasks',
        targetAction: intent.targetAction,
        confidenceScore: intent.confidence,
        requiresConfirmation: intent.requiresConfirmation,
        status: 'WAITING_CLARIFICATION',
        requestPayloadJson: intent.extractedParams,
        updatedAt: new Date().toISOString(),
    });

    const question = buildClarificationQuestion(intent);
    const options = getClarificationOptions(intent, availableBoards);
    await saveAssistantMessage(db, sessionId, question);

    return {
        sessionId,
        assistantMessage: question,
        actionRun: {
            id: actionId,
            status: 'WAITING_CLARIFICATION',
            interpretation: intent.interpretation,
            intentType: intent.intentType,
            clarificationQuestion: question,
            clarificationOptions: options,
            missingParams: intent.missingParams,
        },
    };
}

function buildClarificationQuestion(intent: ClassifiedIntent): string {
    if (intent.confidence < 0.5) {
        return `I'm not sure I understood correctly. Did you mean: "${intent.interpretation}"? Could you clarify?`;
    }
    const missing = intent.missingParams;
    if (missing.length === 1) {
        return `Which ${formatParamName(missing[0])} would you like?`;
    }
    return `I need a few more details:\n${missing.map(p => `• ${formatParamName(p)}`).join('\n')}`;
}

function getClarificationOptions(
    intent: ClassifiedIntent,
    availableBoards?: Array<{ id: string; boardName: string; projectName?: string; columns: string[] }>,
): string[] {
    if ((intent.intentType === 'create_task' || intent.intentType === 'create_tasks_from_notes') && availableBoards?.length) {
        if (intent.missingParams.includes('boardName') || intent.missingParams.includes('boardId')) {
            return availableBoards.map(b =>
                b.projectName ? `${b.projectName} / ${b.boardName}` : b.boardName
            );
        }
        if (intent.missingParams.includes('columnName')) {
            const boardId = intent.extractedParams.boardId as string | undefined;
            if (boardId) {
                const board = availableBoards.find(b => b.id === boardId);
                if (board) return board.columns;
            }
            const allCols = new Set<string>();
            availableBoards.forEach(b => b.columns.forEach(c => allCols.add(c)));
            return Array.from(allCols);
        }
    }
    return [];
}

function formatParamName(param: string): string {
    return param.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase().trim();
}

// ─── Clarification Response ───────────────────────────

async function handleClarificationResponse(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    req: OrchestratorRequest,
    auth: AuthContext,
): Promise<OrchestratorResponse> {
    const { data: actionRun } = await db
        .from('AssistantActionRun')
        .select('*')
        .eq('id', req.respondingToActionId!)
        .eq('sessionId', sessionId)
        .maybeSingle();

    if (!actionRun) {
        const msg = 'I lost track of what we were discussing. Could you start over?';
        await saveAssistantMessage(db, sessionId, msg);
        return { sessionId, assistantMessage: msg };
    }

    const previousParams = (actionRun.requestPayloadJson as Record<string, unknown>) || {};
    const availableBoards = await fetchAvailableBoards(db, auth.companyId);
    const companyName = await getCompanyName(db, auth.companyId);
    const conversationHistory = await getRecentMessages(db, sessionId);

    const intent = await classifyIntent({
        userMessage: req.message,
        currentRoute: req.pageContext.route,
        pageContext: req.pageContext as Record<string, unknown>,
        userRole: auth.role,
        companyName,
        conversationHistory,
        availableBoards,
    });

    // Merge params
    const mergedParams = { ...previousParams, ...intent.extractedParams };
    intent.extractedParams = mergedParams;

    // Remove resolved params from missingParams
    intent.missingParams = intent.missingParams.filter(p => {
        if (p === 'boardName' && (mergedParams.boardId || mergedParams.boardName)) return false;
        if (p === 'columnName' && mergedParams.columnName) return false;
        if (p === 'title' && (mergedParams.title || mergedParams.tasks)) return false;
        return !(p in mergedParams) || !mergedParams[p];
    });

    await db.from('AssistantActionRun').update({
        requestPayloadJson: mergedParams,
        confidenceScore: intent.confidence,
        updatedAt: new Date().toISOString(),
    }).eq('id', actionRun.id);

    if (intent.missingParams.length > 0 || intent.confidence < 0.5) {
        return handleClarification(db, sessionId, intent, auth, availableBoards);
    }

    if (intent.requiresConfirmation || intent.confidence < 0.7) {
        return handleConfirmationRequest(db, sessionId, intent, auth);
    }

    return executeAction(db, sessionId, intent, auth);
}

// ─── Confirmation ─────────────────────────────────────

async function handleConfirmationRequest(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    intent: ClassifiedIntent,
    auth: AuthContext,
): Promise<OrchestratorResponse> {
    const actionId = crypto.randomUUID();

    await db.from('AssistantActionRun').insert({
        id: actionId,
        sessionId,
        companyId: auth.companyId,
        userId: auth.userId,
        intentType: intent.intentType,
        targetModule: DIRECT_ADAPTERS[intent.intentType]?.name || 'tasks',
        targetAction: intent.targetAction,
        confidenceScore: intent.confidence,
        requiresConfirmation: true,
        status: 'WAITING_CONFIRMATION',
        requestPayloadJson: intent.extractedParams,
        updatedAt: new Date().toISOString(),
    });

    const summary = `I'll ${intent.interpretation}. Shall I proceed?`;
    await saveAssistantMessage(db, sessionId, summary);

    return {
        sessionId,
        assistantMessage: summary,
        actionRun: {
            id: actionId,
            status: 'WAITING_CONFIRMATION',
            interpretation: intent.interpretation,
            intentType: intent.intentType,
            confirmationSummary: summary,
        },
    };
}

async function handleConfirmation(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    actionId: string,
    confirmed: boolean,
    auth: AuthContext,
): Promise<OrchestratorResponse> {
    if (!confirmed) {
        await db.from('AssistantActionRun').update({ status: 'BLOCKED', updatedAt: new Date().toISOString() }).eq('id', actionId);
        const msg = 'No problem, action cancelled.';
        await saveAssistantMessage(db, sessionId, msg);
        return { sessionId, assistantMessage: msg };
    }

    const { data: actionRun } = await db.from('AssistantActionRun').select('*').eq('id', actionId).maybeSingle();
    if (!actionRun) {
        const msg = 'I lost the context. Could you try again?';
        await saveAssistantMessage(db, sessionId, msg);
        return { sessionId, assistantMessage: msg };
    }

    const intent: ClassifiedIntent = {
        inputType: 'command',
        executionMode: 'direct',
        intentType: actionRun.intentType,
        targetAction: actionRun.targetAction || '',
        confidence: actionRun.confidenceScore || 0.8,
        extractedParams: (actionRun.requestPayloadJson as Record<string, unknown>) || {},
        missingParams: [],
        requiresConfirmation: false,
        interpretation: '',
    };

    return executeAction(db, sessionId, intent, auth, actionId);
}

// ─── Execute Direct Action ────────────────────────────

async function executeAction(
    db: ReturnType<typeof createAdminClient>,
    sessionId: string,
    intent: ClassifiedIntent,
    auth: AuthContext,
    existingActionId?: string,
): Promise<OrchestratorResponse> {
    const adapter = DIRECT_ADAPTERS[intent.intentType];
    if (!adapter) {
        const msg = `I don't support that action yet. I can create tasks, navigate, open initiatives, or route you to a team member.`;
        await saveAssistantMessage(db, sessionId, msg);
        return { sessionId, assistantMessage: msg };
    }

    // Pre-execution: resolve boardName → boardId for tasks
    if ((intent.intentType === 'create_task' || intent.intentType === 'create_tasks_from_notes') && !intent.extractedParams.boardId) {
        const boardName = String(intent.extractedParams.boardName || intent.extractedParams.projectName || '').trim().toLowerCase();
        if (boardName) {
            const { data: boards } = await db
                .from('TaskBoard')
                .select('id, name, projectId')
                .eq('companyId', auth.companyId);

            if (boards && boards.length > 0) {
                const pIds = [...new Set(boards.filter(b => b.projectId).map(b => b.projectId!))];
                const projectNames: Record<string, string> = {};
                if (pIds.length > 0) {
                    const { data: projects } = await db.from('Project').select('id, name').in('id', pIds);
                    (projects || []).forEach(p => { projectNames[p.id] = p.name; });
                }

                const match = boards.find(b => {
                    const bn = b.name.toLowerCase();
                    const pn = b.projectId ? (projectNames[b.projectId] || '').toLowerCase() : '';
                    return bn.includes(boardName) || boardName.includes(bn) ||
                           pn.includes(boardName) || boardName.includes(pn);
                });

                if (match) {
                    intent.extractedParams.boardId = match.id;
                    if (match.projectId) intent.extractedParams.projectId = match.projectId;
                }
            }
        }
    }

    const actionId = existingActionId || crypto.randomUUID();

    if (!existingActionId) {
        await db.from('AssistantActionRun').insert({
            id: actionId,
            sessionId,
            companyId: auth.companyId,
            userId: auth.userId,
            intentType: intent.intentType,
            targetModule: adapter.name,
            targetAction: intent.targetAction,
            confidenceScore: intent.confidence,
            requiresConfirmation: false,
            status: 'RUNNING',
            requestPayloadJson: intent.extractedParams,
            updatedAt: new Date().toISOString(),
        });
    } else {
        await db.from('AssistantActionRun').update({ status: 'RUNNING', updatedAt: new Date().toISOString() }).eq('id', actionId);
    }

    let result: AdapterResult;
    try {
        result = await adapter.execute(intent.extractedParams, auth);
    } catch (err) {
        console.error(`[orchestrator] Adapter ${adapter.name} failed:`, err);
        result = { success: false, resultSummary: 'Action failed unexpectedly.', error: String(err) };
    }

    // Handle adapter requesting more info
    if (!result.success && result.error === '__NEEDS_BOARD__') {
        await db.from('AssistantActionRun').update({
            status: 'WAITING_CLARIFICATION',
            updatedAt: new Date().toISOString(),
        }).eq('id', actionId);

        const msg = result.resultSummary;
        await saveAssistantMessage(db, sessionId, msg);
        return {
            sessionId,
            assistantMessage: msg,
            actionRun: {
                id: actionId,
                status: 'WAITING_CLARIFICATION',
                interpretation: intent.interpretation,
                intentType: intent.intentType,
                clarificationQuestion: msg,
                missingParams: ['boardName'],
            },
        };
    }

    const finalStatus = result.success ? 'SUCCESS' : 'FAILED';
    await db.from('AssistantActionRun').update({
        status: finalStatus,
        resultPayloadJson: result as unknown as Record<string, unknown>,
        resultLink: result.deepLink || null,
        groundingStatus: result.groundingStatus || null,
        updatedAt: new Date().toISOString(),
    }).eq('id', actionId);

    const msg = result.success
        ? `✓ ${result.resultSummary}`
        : `✗ ${result.resultSummary}`;
    await saveAssistantMessage(db, sessionId, msg);

    return {
        sessionId,
        assistantMessage: msg,
        actionRun: {
            id: actionId,
            status: finalStatus,
            interpretation: intent.interpretation,
            intentType: intent.intentType,
            executionMode: 'direct',
            resultSummary: result.resultSummary,
            deepLink: result.deepLink,
            inlinePreview: result.inlinePreview,
            groundingStatus: result.groundingStatus,
        },
    };
}

// ─── Helpers ──────────────────────────────────────────

async function saveAssistantMessage(db: ReturnType<typeof createAdminClient>, sessionId: string, content: string) {
    await db.from('AssistantMessage').insert({
        id: crypto.randomUUID(),
        sessionId,
        role: 'ASSISTANT',
        content,
        inputMode: 'TEXT',
    });
}

async function getCompanyName(db: ReturnType<typeof createAdminClient>, companyId: string): Promise<string> {
    const { data } = await db.from('Company').select('name').eq('id', companyId).maybeSingle();
    return data?.name || 'Unknown';
}

async function getRecentMessages(db: ReturnType<typeof createAdminClient>, sessionId: string): Promise<Array<{ role: string; content: string }>> {
    const { data } = await db
        .from('AssistantMessage')
        .select('role, content')
        .eq('sessionId', sessionId)
        .order('createdAt', { ascending: false })
        .limit(6);
    return (data || []).reverse();
}
