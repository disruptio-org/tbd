// ═══════════════════════════════════════════════════════
// BOARDROOM V2 — Status Engine (State Machine)
// Governed Autonomous Workflows
// ═══════════════════════════════════════════════════════

import type { InitiativeStatus, TaskStatus, WorkstreamStatus, ExecutionMode } from './constants';

// ─── Initiative State Transitions ─────────────────────

const INITIATIVE_TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  PLAN_DRAFT: ['PLAN_IN_REVIEW', 'CANCELLED'],
  PLAN_IN_REVIEW: ['PLAN_APPROVED', 'PLAN_REVISION', 'CANCELLED'],
  PLAN_REVISION: ['PLAN_IN_REVIEW', 'CANCELLED'],
  PLAN_APPROVED: ['READY_FOR_EXECUTION', 'PLAN_REVISION', 'CANCELLED'],
  READY_FOR_EXECUTION: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_HUMAN_INPUT', 'REVIEW_READY', 'CANCELLED'],
  WAITING_HUMAN_INPUT: ['IN_PROGRESS', 'CANCELLED'],
  REVIEW_READY: ['COMPLETED', 'IN_PROGRESS'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionInitiative(
  from: InitiativeStatus,
  to: InitiativeStatus,
): boolean {
  return INITIATIVE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionInitiative(
  currentStatus: InitiativeStatus,
  targetStatus: InitiativeStatus,
): InitiativeStatus {
  if (!canTransitionInitiative(currentStatus, targetStatus)) {
    throw new Error(
      `Invalid initiative transition: ${currentStatus} → ${targetStatus}`,
    );
  }
  return targetStatus;
}

// ─── Task State Transitions ───────────────────────────

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PLANNED: ['READY_FOR_REVIEW', 'BLOCKED', 'SKIPPED', 'CANCELLED'],
  READY_FOR_REVIEW: ['APPROVED_TO_RUN', 'BLOCKED', 'SKIPPED', 'CANCELLED'],
  APPROVED_TO_RUN: ['RUNNING', 'BLOCKED', 'CANCELLED'],
  RUNNING: ['OUTPUT_READY', 'BLOCKED', 'CANCELLED'],
  OUTPUT_READY: ['VALIDATED', 'NEEDS_REVISION', 'CANCELLED'],
  NEEDS_REVISION: ['APPROVED_TO_RUN', 'RUNNING', 'CANCELLED'],
  VALIDATED: [],  // terminal
  BLOCKED: ['READY_FOR_REVIEW', 'PLANNED', 'CANCELLED'],
  SKIPPED: [],    // terminal
  CANCELLED: [],  // terminal
};

export function canTransitionTask(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionTask(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus,
): TaskStatus {
  if (!canTransitionTask(currentStatus, targetStatus)) {
    throw new Error(
      `Invalid task transition: ${currentStatus} → ${targetStatus}`,
    );
  }
  return targetStatus;
}

// ─── Dependency Checker ───────────────────────────────

interface TaskForDependencyCheck {
  id: string;
  status: string;
  dependsOnTaskIds: string[];
}

/**
 * Check if all upstream dependencies for a task are satisfied (VALIDATED status).
 * Returns { satisfied, blockers } where blockers lists the IDs of unsatisfied tasks.
 */
export function checkDependencies(
  task: TaskForDependencyCheck,
  allTasks: TaskForDependencyCheck[],
): { satisfied: boolean; blockers: string[] } {
  if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) {
    return { satisfied: true, blockers: [] };
  }

  const blockers: string[] = [];
  for (const depId of task.dependsOnTaskIds) {
    const depTask = allTasks.find(t => t.id === depId);
    if (!depTask || (depTask.status !== 'VALIDATED' && depTask.status !== 'SKIPPED')) {
      blockers.push(depId);
    }
  }

  return { satisfied: blockers.length === 0, blockers };
}

// ─── Status Propagation ───────────────────────────────

interface TaskForPropagation {
  id: string;
  status: string;
  workstreamId: string | null;
}

/**
 * Roll up task statuses to determine workstream status.
 */
export function computeWorkstreamStatus(
  tasks: TaskForPropagation[],
): WorkstreamStatus {
  if (tasks.length === 0) return 'NOT_STARTED';

  const allDone = tasks.every(t => t.status === 'VALIDATED' || t.status === 'CANCELLED' || t.status === 'SKIPPED');
  const anyBlocked = tasks.some(t => t.status === 'BLOCKED');
  const anyActive = tasks.some(
    t => t.status === 'RUNNING' || t.status === 'APPROVED_TO_RUN' || t.status === 'READY_FOR_REVIEW' || t.status === 'OUTPUT_READY' || t.status === 'NEEDS_REVISION',
  );
  const allPlanned = tasks.every(t => t.status === 'PLANNED');

  if (allDone) return 'COMPLETED';
  if (allPlanned) return 'NOT_STARTED';
  if (anyBlocked && !anyActive) return 'BLOCKED';
  return 'IN_PROGRESS';
}

/**
 * Determine what the initiative status should be based on all task statuses.
 * Only suggests transitions — does not enforce them.
 */
export function computeInitiativeStatusFromTasks(
  tasks: TaskForPropagation[],
  currentStatus: InitiativeStatus,
): InitiativeStatus | null {
  if (tasks.length === 0) return null;

  const allValidated = tasks.every(t =>
    t.status === 'VALIDATED' || t.status === 'CANCELLED' || t.status === 'SKIPPED',
  );
  const anyOutputReady = tasks.some(t => t.status === 'OUTPUT_READY' || t.status === 'NEEDS_REVISION');
  const allBlocked = tasks.every(
    t => t.status === 'BLOCKED' || t.status === 'PLANNED' || t.status === 'CANCELLED' || t.status === 'SKIPPED',
  );

  // All tasks validated → suggest REVIEW_READY
  if (allValidated && currentStatus === 'IN_PROGRESS') {
    return 'REVIEW_READY';
  }

  // Tasks have outputs waiting for human → suggest WAITING_HUMAN_INPUT
  if (anyOutputReady && currentStatus === 'IN_PROGRESS') {
    return 'WAITING_HUMAN_INPUT';
  }

  // All tasks blocked → suggest WAITING_HUMAN_INPUT
  if (allBlocked && currentStatus === 'IN_PROGRESS') {
    return 'WAITING_HUMAN_INPUT';
  }

  return null; // no suggestion
}

// ─── Progress Calculation ─────────────────────────────

export function computeInitiativeProgress(
  tasks: TaskForPropagation[],
): number {
  if (tasks.length === 0) return 0;

  const completedOrValidated = tasks.filter(
    t => t.status === 'VALIDATED' || t.status === 'SKIPPED',
  ).length;

  return Math.round((completedOrValidated / tasks.length) * 100);
}

// ─── Execution Mode Aware Task Progression ────────────

/**
 * Determine the next status for a newly-unblocked task based on execution mode.
 * - AUTO_CHAIN: tasks go to APPROVED_TO_RUN (or READY_FOR_REVIEW if preApproval required)
 * - MANUAL: tasks always go to READY_FOR_REVIEW (wait for user)
 */
export function getNextStatusForUnblockedTask(
  executionMode: ExecutionMode,
  requiresApprovalBeforeRun: boolean,
): TaskStatus {
  if (executionMode === 'AUTO_CHAIN') {
    return requiresApprovalBeforeRun ? 'READY_FOR_REVIEW' : 'APPROVED_TO_RUN';
  }
  // MANUAL mode — always wait for user review
  return 'READY_FOR_REVIEW';
}

// ─── Auto-Start Eligible Tasks ────────────────────────

/**
 * For an initiative transitioning to IN_PROGRESS (or after a task validates),
 * check which PLANNED tasks have dependencies met and promote them.
 * Respects execution mode for determining target status.
 * Returns the count of tasks that were promoted.
 */
export async function autoStartEligibleTasks(
  db: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  initiativeId: string,
  executionMode: ExecutionMode = 'MANUAL',
): Promise<number> {
  const { data: tasks } = await db
    .from('InitiativeTask')
    .select('id, status, dependsOnTaskIds, requiresApprovalBeforeRun')
    .eq('initiativeId', initiativeId)
    .order('position');

  if (!tasks || tasks.length === 0) return 0;

  const now = new Date().toISOString();
  let promotedCount = 0;

  for (const task of tasks) {
    // Only promote PLANNED tasks
    if (task.status !== 'PLANNED') continue;

    const deps = task.dependsOnTaskIds || [];
    const { satisfied } = checkDependencies(task, tasks);

    if (deps.length === 0 || satisfied) {
      const nextStatus = getNextStatusForUnblockedTask(
        executionMode,
        task.requiresApprovalBeforeRun ?? true,
      );
      await db.from('InitiativeTask').update({
        status: nextStatus,
        updatedAt: now,
      }).eq('id', task.id);
      promotedCount++;
    } else {
      // Has unmet dependencies → BLOCKED
      await db.from('InitiativeTask').update({
        status: 'BLOCKED',
        updatedAt: now,
      }).eq('id', task.id);
    }
  }

  return promotedCount;
}

/**
 * After a task is validated, check if dependent tasks can now be promoted.
 * Called after any task validation to propagate readiness.
 */
export async function propagateTaskCompletion(
  db: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  initiativeId: string,
  executionMode: ExecutionMode = 'MANUAL',
): Promise<number> {
  const { data: tasks } = await db
    .from('InitiativeTask')
    .select('id, status, dependsOnTaskIds, requiresApprovalBeforeRun')
    .eq('initiativeId', initiativeId)
    .order('position');

  if (!tasks || tasks.length === 0) return 0;

  const now = new Date().toISOString();
  let unblocked = 0;

  for (const task of tasks) {
    if (task.status !== 'BLOCKED' && task.status !== 'PLANNED') continue;

    const { satisfied } = checkDependencies(task, tasks);
    if (satisfied) {
      const nextStatus = getNextStatusForUnblockedTask(
        executionMode,
        task.requiresApprovalBeforeRun ?? true,
      );
      await db.from('InitiativeTask').update({
        status: nextStatus,
        updatedAt: now,
      }).eq('id', task.id);
      unblocked++;
    }
  }

  return unblocked;
}
