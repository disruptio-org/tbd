// ═══════════════════════════════════════════════════════
// BOARDROOM V2 — Constants & Enums
// Governed Autonomous Workflows
// ═══════════════════════════════════════════════════════

// ─── Initiative Statuses ──────────────────────────────

export const INITIATIVE_STATUSES = [
  'PLAN_DRAFT',
  'PLAN_IN_REVIEW',
  'PLAN_REVISION',
  'PLAN_APPROVED',
  'READY_FOR_EXECUTION',
  'IN_PROGRESS',
  'WAITING_HUMAN_INPUT',
  'REVIEW_READY',
  'COMPLETED',
  'CANCELLED',
] as const;

export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];

export const INITIATIVE_STATUS_LABELS: Record<InitiativeStatus, string> = {
  PLAN_DRAFT: 'Draft Plan',
  PLAN_IN_REVIEW: 'Plan Under Review',
  PLAN_REVISION: 'Plan Revision',
  PLAN_APPROVED: 'Plan Approved',
  READY_FOR_EXECUTION: 'Ready for Execution',
  IN_PROGRESS: 'In Progress',
  WAITING_HUMAN_INPUT: 'Waiting on Human',
  REVIEW_READY: 'Review Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const INITIATIVE_STATUS_COLORS: Record<InitiativeStatus, string> = {
  PLAN_DRAFT: '#94a3b8',
  PLAN_IN_REVIEW: '#f59e0b',
  PLAN_REVISION: '#f97316',
  PLAN_APPROVED: '#8b5cf6',
  READY_FOR_EXECUTION: '#2563eb',
  IN_PROGRESS: '#2563eb',
  WAITING_HUMAN_INPUT: '#f59e0b',
  REVIEW_READY: '#06b6d4',
  COMPLETED: '#22c55e',
  CANCELLED: '#64748b',
};

// ─── Task Statuses ────────────────────────────────────

export const TASK_STATUSES = [
  'PLANNED',
  'READY_FOR_REVIEW',
  'APPROVED_TO_RUN',
  'RUNNING',
  'OUTPUT_READY',
  'NEEDS_REVISION',
  'VALIDATED',
  'BLOCKED',
  'SKIPPED',
  'CANCELLED',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PLANNED: 'Planned',
  READY_FOR_REVIEW: 'Ready for Review',
  APPROVED_TO_RUN: 'Approved to Run',
  RUNNING: 'Running',
  OUTPUT_READY: 'Output Ready',
  NEEDS_REVISION: 'Needs Revision',
  VALIDATED: 'Validated',
  BLOCKED: 'Blocked',
  SKIPPED: 'Skipped',
  CANCELLED: 'Cancelled',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  PLANNED: '#94a3b8',
  READY_FOR_REVIEW: '#f59e0b',
  APPROVED_TO_RUN: '#8b5cf6',
  RUNNING: '#2563eb',
  OUTPUT_READY: '#06b6d4',
  NEEDS_REVISION: '#ef4444',
  VALIDATED: '#22c55e',
  BLOCKED: '#f97316',
  SKIPPED: '#64748b',
  CANCELLED: '#64748b',
};

// ─── Execution Modes ──────────────────────────────────

export const EXECUTION_MODES = [
  'AUTO_CHAIN',
  'MANUAL',
] as const;

export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const EXECUTION_MODE_LABELS: Record<ExecutionMode, string> = {
  AUTO_CHAIN: 'Auto-Chain with Approvals',
  MANUAL: 'Manual Step-by-Step',
};

// ─── Plan Draft Statuses ──────────────────────────────

export const PLAN_DRAFT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'REVISION',
  'APPROVED',
  'DISCARDED',
] as const;

export type PlanDraftStatus = (typeof PLAN_DRAFT_STATUSES)[number];

// ─── Workstream Statuses ──────────────────────────────

export const WORKSTREAM_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
] as const;

export type WorkstreamStatus = (typeof WORKSTREAM_STATUSES)[number];

// ─── Approval Gate Types ──────────────────────────────

export const APPROVAL_GATE_TYPES = [
  'plan_approval',
  'design_review',
  'publish',
  'deploy',
  'outbound',
  'budget',
  'crm_import',
  'destructive',
  'client_facing',
  'custom',
] as const;

export type ApprovalGateType = (typeof APPROVAL_GATE_TYPES)[number];

export const APPROVAL_GATE_LABELS: Record<ApprovalGateType, string> = {
  plan_approval: 'Plan Approval',
  design_review: 'Design Review',
  publish: 'Publish Content',
  deploy: 'Deploy Code/Website',
  outbound: 'Outbound Communication',
  budget: 'Budget Decision',
  crm_import: 'CRM Import/Activation',
  destructive: 'Destructive Action',
  client_facing: 'Client-Facing Change',
  custom: 'Custom Gate',
};

// ─── Approval Request Statuses ────────────────────────

export const APPROVAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'REVISION_REQUESTED',
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

// ─── Work Types ───────────────────────────────────────

export const WORK_TYPES = [
  'website',
  'campaign',
  'lead_discovery',
  'feature',
  'content',
  'custom',
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  website: 'Website Creation',
  campaign: 'Campaign Launch',
  lead_discovery: 'Lead Discovery',
  feature: 'Feature Implementation',
  content: 'Content Production',
  custom: 'Custom',
};

export const WORK_TYPE_ICONS: Record<WorkType, string> = {
  website: 'globe',
  campaign: 'megaphone',
  lead_discovery: 'target',
  feature: 'code',
  content: 'file-text',
  custom: 'sparkles',
};

// ─── Approval Modes ──────────────────────────────────

export const APPROVAL_MODES = [
  'MANUAL',      // Human approves everything
  'SEMI_AUTO',   // AI plans auto, execution gated
  'AUTO_LIMITED', // Auto within limits, gate on outbound/deploy/budget
] as const;

export type ApprovalMode = (typeof APPROVAL_MODES)[number];

// ─── Artifact Types ──────────────────────────────────

export const ARTIFACT_TYPES = [
  'prd',
  'wireframe',
  'content_draft',
  'lead_list',
  'campaign_plan',
  'technical_plan',
  'website_structure',
  'implementation_plan',
  'code',
  'custom',
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  prd: 'Product Requirements',
  wireframe: 'Wireframe / Mockup',
  content_draft: 'Content Draft',
  lead_list: 'Lead List',
  campaign_plan: 'Campaign Plan',
  technical_plan: 'Technical Plan',
  website_structure: 'Website Structure',
  implementation_plan: 'Implementation Plan',
  code: 'Code',
  custom: 'Custom',
};

// ─── Artifact Statuses ────────────────────────────────

export const ARTIFACT_STATUSES = [
  'DRAFT',
  'READY',
  'APPROVED',
  'SUPERSEDED',
] as const;

export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

// ─── Priority Levels ──────────────────────────────────

export const PRIORITY_LEVELS = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  low: '#94a3b8',
  medium: '#2563eb',
  high: '#f97316',
  urgent: '#ef4444',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

// ─── Event Actions ────────────────────────────────────

export const EVENT_ACTIONS = [
  'created',
  'planned',
  'approved',
  'rejected',
  'started',
  'completed',
  'blocked',
  'unblocked',
  'comment',
  'artifact_added',
  'artifact_approved',
  'revision_requested',
  'task_assigned',
  'task_completed',
  'task_delivered',
  'task_validated',
  'task_approved_to_run',
  'execution_started',
  'execution_mode_changed',
  'cancelled',
] as const;

export type EventAction = (typeof EVENT_ACTIONS)[number];

// ─── Mandatory Approval Gates by Work Type ────────────
// These gates are ALWAYS required and cannot be skipped

export const MANDATORY_APPROVAL_GATES: ApprovalGateType[] = [
  'plan_approval',
  'publish',
  'deploy',
  'outbound',
  'budget',
  'crm_import',
  'destructive',
  'client_facing',
];

// ─── Default Approval Gates per Work Type ─────────────

export const DEFAULT_GATES_BY_WORK_TYPE: Record<WorkType, ApprovalGateType[]> = {
  website: ['plan_approval', 'design_review', 'deploy', 'client_facing'],
  campaign: ['plan_approval', 'publish', 'outbound', 'client_facing'],
  lead_discovery: ['plan_approval', 'crm_import', 'outbound'],
  feature: ['plan_approval', 'design_review', 'deploy'],
  content: ['plan_approval', 'publish', 'client_facing'],
  custom: ['plan_approval'],
};
