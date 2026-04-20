# Boardroom — End-to-End Architecture & Implementation

> **Last updated**: 2026-04-09  
> **Module**: `src/app/(dashboard)/boardroom/` + `src/app/api/boardroom/` + `src/lib/boardroom/`

---

## 1. Overview

The **Boardroom** is the AI-powered orchestration layer of Nousio. It turns a plain-language user command (e.g., *"Launch a LinkedIn campaign for our new product"*) into a structured, multi-phase initiative with workstreams, tasks, approval gates, and artifacts — all executed by AI team members with human governance.

### Core Concepts

| Concept | Description |
|---|---|
| **Initiative** | A strategic project created from a user command. Contains workstreams, tasks, approvals, and artifacts. |
| **Workstream** | A logical phase within an initiative (e.g., "Research", "Content Production", "Review & Publish"). |
| **Task** | An atomic unit of work assigned to a specific AI brain type. Has dependencies, status, and output. |
| **Approval Gate** | A governance checkpoint requiring human approval before proceeding (e.g., publish, deploy, outbound). |
| **Artifact** | A deliverable produced by a task (e.g., a content draft, a PRD, a lead list). |
| **Event** | An immutable audit log entry tracking every action in the initiative lifecycle. |

---

## 2. Database Schema

All Boardroom tables live in the Prisma schema under the section `BOARDROOM — AI Team Orchestration Layer`.

### 2.1 Initiative

```
model Initiative {
  id               String     @id @default(uuid())
  companyId        String
  projectId        String?
  title            String
  objective        String     @db.Text
  businessGoal     String?    @db.Text
  requestedOutcome String?    @db.Text
  workType         String?    // website | campaign | lead_discovery | feature | content | custom
  confidenceScore  Float?
  status           String     @default("DRAFT")
  priority         String     @default("medium")
  executionState   String     @default("NOT_STARTED")
  approvalMode     String     @default("MANUAL")
  sourceCommand    String?    @db.Text
  planSummary      String?    @db.Text
  createdById      String
  completedAt      DateTime?
}
```

**Key fields**:
- `sourceCommand` — the raw user command that triggered this initiative
- `planSummary` — AI-generated execution plan summary
- `confidenceScore` — AI's confidence (0-100) in its ability to execute
- `approvalMode` — `MANUAL` (human approves everything), `SEMI_AUTO` (AI plans auto, execution gated), `AUTO_LIMITED` (auto within limits)

### 2.2 InitiativeWorkstream

```
model InitiativeWorkstream {
  id           String   @id
  initiativeId String
  title        String
  description  String?
  position     Int      @default(0)
  status       String   @default("NOT_STARTED")
  // NOT_STARTED | IN_PROGRESS | COMPLETED | BLOCKED
}
```

### 2.3 InitiativeTask

```
model InitiativeTask {
  id                String    @id
  initiativeId      String
  workstreamId      String?
  title             String
  description       String?
  assignedBrainType String?   // MARKETING | SALES | PRODUCT_ASSISTANT | etc.
  assignedBrainId   String?   // FK to AIBrainProfile
  requiredSkill     String?   // skill key from AssistantSkill
  status            String    @default("NOT_STARTED")
  position          Int       @default(0)
  dueTarget         DateTime?
  deliveredAt       DateTime?
  outputSummary     String?
  dependsOnTaskIds  String[]  // array of InitiativeTask IDs
}
```

### 2.4 ApprovalRequest

```
model ApprovalRequest {
  id           String    @id
  initiativeId String
  taskId       String?   // null = initiative-level approval
  gateType     String    // plan_approval | design_review | publish | deploy | outbound | budget | etc.
  title        String
  description  String?
  status       String    @default("PENDING")
  // PENDING | APPROVED | REJECTED | REVISION_REQUESTED
  decidedById  String?
  decidedAt    DateTime?
  decisionNote String?
}
```

### 2.5 InitiativeArtifact

```
model InitiativeArtifact {
  id           String   @id
  initiativeId String
  taskId       String?
  artifactType String   // prd | wireframe | content_draft | lead_list | etc.
  title        String
  content      String?
  contentUrl   String?
  storageKey   String?
  status       String   @default("DRAFT")
  // DRAFT | READY | APPROVED | SUPERSEDED
}
```

### 2.6 InitiativeEvent

```
model InitiativeEvent {
  id           String   @id
  initiativeId String
  actorType    String   // user | system | ai_member
  actorLabel   String?
  action       String   // created | planned | approved | rejected | started | completed | blocked | comment | artifact_added | revision_requested
  description  String?
  metadata     Json?
}
```

---

## 3. State Machines

### 3.1 Initiative Status Lifecycle

**File**: `src/lib/boardroom/status-engine.ts`

```
DRAFT ──────────→ PLANNING ──────────→ AWAITING_APPROVAL
                                            │
                                    ┌───────┼───────┐
                                    ↓       ↓       ↓
                                APPROVED  PLANNING  CANCELLED
                                    │
                                    ↓
                              IN_PROGRESS
                                    │
                            ┌───────┼───────┐
                            ↓       ↓       ↓
                        BLOCKED  REVIEW_READY  CANCELLED
                            │       │
                            ↓       ↓
                      IN_PROGRESS  COMPLETED
```

**Statuses**:
| Status | Description |
|---|---|
| `DRAFT` | Initiative created but not yet planned |
| `PLANNING` | AI is generating the execution plan |
| `AWAITING_APPROVAL` | Plan generated, waiting for human approval |
| `APPROVED` | Plan approved but execution not yet started |
| `IN_PROGRESS` | Tasks are being executed |
| `BLOCKED` | All tasks are waiting on dependencies or approvals |
| `REVIEW_READY` | All tasks delivered, awaiting final review |
| `COMPLETED` | Initiative successfully completed |
| `CANCELLED` | Initiative cancelled by user |

### 3.2 Task Status Lifecycle

```
NOT_STARTED ──→ READY ──→ IN_PROGRESS ──→ DELIVERED ──→ DONE
                    │           │               │
                    ↓           ↓               ↓
             WAITING_DEPENDENCY  WAITING_APPROVAL  NEEDS_REVISION
                    │           │                      │
                    ↓           ↓                      ↓
                READY/IN_PROGRESS  DELIVERED/NEEDS_REVISION  IN_PROGRESS
```

**Statuses**:
| Status | Description |
|---|---|
| `NOT_STARTED` | Task created but not yet actionable |
| `READY` | Dependencies met, ready to execute |
| `IN_PROGRESS` | AI brain is actively working on the task |
| `WAITING_DEPENDENCY` | Blocked by unfinished upstream tasks |
| `WAITING_APPROVAL` | Work done, but requires approval gate |
| `DELIVERED` | Output produced and delivered |
| `NEEDS_REVISION` | Approval rejected, needs rework |
| `DONE` | Task completed and approved |
| `CANCELLED` | Task cancelled |

### 3.3 Automatic Status Propagation

The status engine includes two key automation functions:

1. **`autoStartEligibleTasks(db, initiativeId)`** — When an initiative transitions to `IN_PROGRESS`, automatically starts all tasks with no dependencies (or met dependencies). Tasks with unmet dependencies are set to `WAITING_DEPENDENCY`.

2. **`propagateTaskCompletion(db, initiativeId)`** — When any task reaches `DONE`, checks all `WAITING_DEPENDENCY` tasks to see if their blockers are now resolved, and auto-promotes them to `IN_PROGRESS`.

3. **`computeInitiativeStatusFromTasks(tasks, currentStatus)`** — Suggests initiative status changes based on aggregate task states (e.g., all tasks delivered → `REVIEW_READY`).

---

## 4. API Routes

### 4.1 Command (Plan Generation)

#### `POST /api/boardroom/command`

The entry point for the entire Boardroom flow. Takes a natural language command and returns a structured execution plan.

**Body**: `{ command: string, projectId?: string }`

**Flow**:
1. Authenticates user, resolves `companyId`
2. Gathers context:
   - Company profile (name, website, webContext)
   - Company DNA (mission, products, target audience, tone)
   - Project context (if `projectId` provided)
   - AI team members (all enabled `AIBrainProfile` records)
   - **Wiki context** via `retrieveWikiContext()` — compiled knowledge pages
3. Builds orchestrator prompt (`buildOrchestratorSystemPrompt()`)
4. Calls **GPT-4o** with structured JSON output
5. Returns the plan draft (not persisted yet) for user review

**Response**:
```json
{
  "plan": {
    "workType": "campaign",
    "objective": "...",
    "businessGoal": "...",
    "confidenceScore": 85,
    "planSummary": "...",
    "workstreams": [...],
    "tasks": [...],
    "approvalGates": [...]
  },
  "command": "Launch a LinkedIn campaign",
  "projectId": null,
  "teamMembers": [...]
}
```

---

### 4.2 Initiatives CRUD

#### `GET /api/boardroom/initiatives`

Lists all initiatives for the company. Enriched with task counts, progress, brain types, and pending approvals.

**Query params**: `status`, `projectId`, `priority`

#### `POST /api/boardroom/initiatives`

Creates a new initiative from an approved plan. Handles:
- Initiative record creation
- Workstream creation (batch insert)
- Task creation with workstream mapping and dependency linking
- Approval gate creation
- Event logging (created + planned)
- Auto-assigns to default project if none specified

**Status logic**: If `planSummary` is provided → `AWAITING_APPROVAL`, otherwise → `DRAFT`

#### `GET /api/boardroom/initiatives/[id]`

Returns full initiative detail including all related data in parallel:
- Initiative + project name
- Workstreams (ordered by position)
- Tasks (ordered by position, enriched with brain names)
- Approval requests (newest first)
- Artifacts (newest first)
- Events (newest first, limit 50)

#### `PUT /api/boardroom/initiatives/[id]`

Updates initiative fields. Handles status transitions with validation via `canTransitionInitiative()`. When transitioning to `IN_PROGRESS`, calls `autoStartEligibleTasks()`.

#### `DELETE /api/boardroom/initiatives/[id]`

Cascade deletes: Events → Artifacts → Approvals → Tasks → Workstreams → Initiative.

---

### 4.3 Approval System

#### `POST /api/boardroom/initiatives/[id]/approve`

Handles both initiative-level and task-level approvals.

**Body**: `{ approvalId?: string, action: 'approve' | 'reject' | 'revision', note?: string }`

**Initiative-level approval** (no `approvalId`):
- Validates initiative is `AWAITING_APPROVAL`
- On `approve`: transitions to `APPROVED` → immediately to `IN_PROGRESS` → auto-starts eligible tasks
- On `reject`: transitions to `CANCELLED`
- On `revision`: transitions back to `PLANNING`

**Task-level approval** (with `approvalId`):
- On `approve`: task → `DELIVERED`
- On `reject`: task → `NEEDS_REVISION`
- Logs event with gate type

---

### 4.4 Task Execution

#### `POST /api/boardroom/initiatives/[id]/tasks/[taskId]/execute`

The core AI execution endpoint. Fires the assigned AI brain to produce task output.

**Prerequisites**: Initiative must be `IN_PROGRESS`, task must be `IN_PROGRESS`.

**Flow**:
1. Gathers full context:
   - Company profile + DNA
   - Brain profile (personality, instructions) resolved by `assignedBrainId` or `assignedBrainType`
   - Initiative details (title, objective, plan)
   - Completed task outputs (for chain-of-work context)
2. Builds a task-specific system prompt with all context
3. Calls **GPT-4o** with JSON response format
4. Parses structured output: `{ output, summary, artifactTitle, artifactType }`
5. Updates task: status → `DELIVERED`, sets `outputSummary` and `deliveredAt`
6. Creates `InitiativeArtifact` if the AI produced a named deliverable
7. Logs `task_delivered` event

#### `GET /api/boardroom/initiatives/[id]/tasks`

Lists all tasks for an initiative with assignee resolution.

#### `POST /api/boardroom/initiatives/[id]/tasks/[taskId]/generate-image`

Generates images using AI for visual tasks (e.g., wireframes, designs).

#### `POST /api/boardroom/initiatives/[id]/tasks/[taskId]/edit-image`

Edits/refines a previously generated image.

---

### 4.5 Supporting Routes

#### `GET /api/boardroom/initiatives/[id]/events`

Activity log for the initiative timeline.

#### `GET /api/boardroom/initiatives/[id]/artifacts`

Lists all artifacts produced by the initiative's tasks.

#### `POST /api/boardroom/initiatives/[id]/discuss`

Threaded discussion within an initiative (adds comment events).

#### `GET /api/boardroom/summary`

Dashboard summary: counts by status for the Overview panel.

---

## 5. Library Layer

### 5.1 Constants (`src/lib/boardroom/constants.ts`)

Defines all enums, labels, colors, and type mappings:

| Export | Description |
|---|---|
| `INITIATIVE_STATUSES` | 9 statuses with labels + colors |
| `TASK_STATUSES` | 9 statuses with labels + colors |
| `WORKSTREAM_STATUSES` | 4 statuses |
| `APPROVAL_GATE_TYPES` | 10 types (plan_approval, design_review, publish, deploy, outbound, budget, crm_import, destructive, client_facing, custom) |
| `WORK_TYPES` | 6 types (website, campaign, lead_discovery, feature, content, custom) |
| `ARTIFACT_TYPES` | 10 types (prd, wireframe, content_draft, lead_list, etc.) |
| `PRIORITY_LEVELS` | 4 levels (low, medium, high, urgent) |
| `MANDATORY_APPROVAL_GATES` | Gates that can NEVER be skipped |
| `DEFAULT_GATES_BY_WORK_TYPE` | Pre-configured gates per work type |

### 5.2 Prompts (`src/lib/boardroom/prompts.ts`)

Two prompt builders:

1. **`buildOrchestratorSystemPrompt(companyContext, teamMembers, wikiContext?)`**
   - Defines "Company DNA" as the executive AI brain
   - Injects company context, wiki pages, and available team members
   - Specifies exact JSON response schema with workstreams, tasks, dependencies, and approval gates
   - Enforces governance rules (always include plan_approval, never auto-publish/deploy)

2. **`buildOrchestratorUserMessage(command, projectContext?)`**
   - Wraps the user's command with optional project context

### 5.3 Status Engine (`src/lib/boardroom/status-engine.ts`)

Pure logic layer (no DB calls in the pure functions):

| Function | Description |
|---|---|
| `canTransitionInitiative(from, to)` | Validates a status transition is allowed |
| `transitionInitiative(from, to)` | Performs transition or throws |
| `canTransitionTask(from, to)` | Validates task status transition |
| `checkDependencies(task, allTasks)` | Returns `{ satisfied, blockers }` |
| `computeWorkstreamStatus(tasks)` | Rolls up task states to workstream status |
| `computeInitiativeStatusFromTasks(tasks, currentStatus)` | Suggests initiative status from task aggregate |
| `computeInitiativeProgress(tasks)` | Returns progress % (delivered+done / total) |
| `autoStartEligibleTasks(db, initiativeId)` | Auto-starts tasks when initiative begins |
| `propagateTaskCompletion(db, initiativeId)` | Unblocks waiting tasks after completion |

---

## 6. Frontend Flow

### 6.1 Pages

| Route | File | Description |
|---|---|---|
| `/boardroom` | `src/app/(dashboard)/boardroom/page.tsx` | Main Boardroom page with command bar, initiative list, and plan review |
| `/boardroom/[id]` | `src/app/(dashboard)/boardroom/[id]/` | Initiative detail view with tasks, artifacts, events, and approvals |

### 6.2 Main Page (`/boardroom`)

**Layout** (595 lines, fully client-side):

1. **Summary Bar** — Fetches `GET /api/boardroom/summary` for status counts (draft, in progress, blocked, completed)
2. **Command Bar** — Text input where user types a natural language command
3. **Plan Preview Modal** — After `POST /api/boardroom/command`, shows the AI-generated plan with:
   - Work type, objective, business goal
   - Workstreams and tasks list
   - Assigned AI team members
   - Approval gates
   - Confidence score
   - **Approve** / **Reject** buttons
4. **Initiative List** — Fetches `GET /api/boardroom/initiatives`, shows cards with:
   - Status badge + priority indicator
   - Progress bar (% complete)
   - Team member avatars (by brain type initials)
   - Pending approval count
   - Project name

### 6.3 User Journey (E2E)

```
┌─────────────────────────────────────────────────────────────┐
│  User types: "Create a product launch campaign for Q3"      │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  POST /api/boardroom/command                                │
│  → Gathers company DNA + wiki + team members                │
│  → GPT-4o generates structured plan                         │
│  → Returns plan JSON (not saved yet)                        │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  Plan Preview Modal                                         │
│  User reviews: workstreams, tasks, gates, confidence        │
│  User clicks [✓ Approve Plan]                               │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  POST /api/boardroom/initiatives                            │
│  → Creates Initiative (status: AWAITING_APPROVAL)           │
│  → Creates Workstreams                                      │
│  → Creates Tasks (all NOT_STARTED)                          │
│  → Creates ApprovalRequests (plan_approval + work-type gates)│
│  → Logs "created" + "planned" events                        │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  POST /api/boardroom/initiatives/[id]/approve               │
│  { action: "approve" }                                      │
│  → Initiative: AWAITING_APPROVAL → APPROVED → IN_PROGRESS  │
│  → plan_approval gate: PENDING → APPROVED                   │
│  → autoStartEligibleTasks():                                │
│    • Tasks with no deps → IN_PROGRESS                       │
│    • Tasks with unmet deps → WAITING_DEPENDENCY             │
│  → Logs "approved" + "execution_started" events             │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  POST /api/boardroom/initiatives/[id]/tasks/[taskId]/execute│
│  (for each IN_PROGRESS task)                                │
│  → Gathers: company DNA + brain profile + prior task outputs│
│  → GPT-4o produces task output + artifact                   │
│  → Task: IN_PROGRESS → DELIVERED                            │
│  → Creates InitiativeArtifact                               │
│  → propagateTaskCompletion() unblocks dependent tasks       │
│  → Logs "task_delivered" event                              │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  User reviews delivered tasks                               │
│  → Approve task: DELIVERED → DONE                           │
│  → Reject task: DELIVERED → NEEDS_REVISION → re-execute     │
│  → All tasks DONE → Initiative: IN_PROGRESS → REVIEW_READY │
│  → Final approval → Initiative: REVIEW_READY → COMPLETED   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Governance Rules

### 7.1 Mandatory Approval Gates

These gates are **always required** and cannot be skipped:
- `plan_approval` — Every initiative requires plan approval before execution
- `publish` — Content publication
- `deploy` — Code/website deployment
- `outbound` — External communication (emails, messages)
- `budget` — Financial decisions
- `crm_import` — CRM data imports/activations
- `destructive` — Data deletion or irreversible actions
- `client_facing` — Changes visible to clients

### 7.2 Default Gates per Work Type

| Work Type | Default Gates |
|---|---|
| Website | plan_approval, design_review, deploy, client_facing |
| Campaign | plan_approval, publish, outbound, client_facing |
| Lead Discovery | plan_approval, crm_import, outbound |
| Feature | plan_approval, design_review, deploy |
| Content | plan_approval, publish, client_facing |
| Custom | plan_approval |

### 7.3 Approval Modes

| Mode | Behavior |
|---|---|
| `MANUAL` | Human approves everything |
| `SEMI_AUTO` | AI generates plans automatically, but execution requires approval |
| `AUTO_LIMITED` | Auto-executes within limits, gates on outbound/deploy/budget |

---

## 8. AI Context Chain

When a task executes, the AI receives a **full context chain**:

```
┌──────────────────────────────────────────┐
│  Company Profile (name, website, about)  │
├──────────────────────────────────────────┤
│  Company DNA (mission, products, tone)   │
├──────────────────────────────────────────┤
│  Wiki Context (compiled knowledge)       │  ← from wiki/retriever.ts
├──────────────────────────────────────────┤
│  Brain Profile (personality, role,       │  ← from AIBrainProfile
│  instructions, custom training)          │
├──────────────────────────────────────────┤
│  Initiative (title, objective, plan)     │
├──────────────────────────────────────────┤
│  Prior Task Outputs (chain of work)      │  ← completed task summaries
├──────────────────────────────────────────┤
│  Current Task (title, description, skill)│
└──────────────────────────────────────────┘
```

This ensures each AI brain has the full business context + prior deliverables when executing its specific task.

---

## 9. File Map

```
src/
├── lib/boardroom/
│   ├── constants.ts          # All enums, labels, colors, gate configs
│   ├── prompts.ts            # LLM prompt builders (orchestrator + user)
│   └── status-engine.ts      # State machine (transitions, deps, propagation)
│
├── app/api/boardroom/
│   ├── command/route.ts                              # POST — AI plan generation
│   ├── summary/route.ts                              # GET  — Dashboard summary
│   └── initiatives/
│       ├── route.ts                                  # GET/POST — List/Create
│       └── [id]/
│           ├── route.ts                              # GET/PUT/DELETE — Detail/Update/Delete
│           ├── approve/route.ts                      # POST — Approve/Reject/Revise
│           ├── artifacts/route.ts                    # GET  — List artifacts
│           ├── discuss/route.ts                      # POST — Add discussion
│           ├── events/route.ts                       # GET  — Activity log
│           └── tasks/
│               ├── route.ts                          # GET/POST — List/Create tasks
│               └── [taskId]/
│                   ├── execute/route.ts              # POST — AI task execution
│                   ├── generate-image/route.ts       # POST — Image generation
│                   └── edit-image/route.ts           # POST — Image editing
│
├── app/(dashboard)/boardroom/
│   ├── page.tsx              # Main Boardroom page (command bar + initiative list)
│   ├── boardroom.css         # Dark OS styles
│   └── [id]/                 # Initiative detail page
│
└── prisma/schema.prisma      # Initiative, InitiativeWorkstream, InitiativeTask,
                               # ApprovalRequest, InitiativeEvent, InitiativeArtifact
```

---

## 10. Key Dependencies

| Dependency | Usage |
|---|---|
| `openai` (GPT-4o) | Plan generation (`/command`) and task execution (`/execute`) |
| `@/lib/supabase/admin` | All DB operations use the admin client (bypasses RLS) |
| `@/lib/auth` | `getCurrentUser()` for authentication on every endpoint |
| `@/lib/wiki/retriever` | Company knowledge retrieval for context-aware planning |
| `@/lib/boardroom/status-engine` | State machine validation and automation |
| `@/lib/boardroom/prompts` | Structured prompt generation |
| `@/lib/boardroom/constants` | Type-safe enums and configuration |

---

## 11. Known Limitations & Future Work

1. **Manual task execution** — Tasks currently require manual triggering via the UI (click "Execute"). Background orchestration is not yet automated.
2. **No real-time updates** — The initiative detail page polls on refresh; no WebSocket/SSE push for live status updates.
3. **Sequential execution** — Tasks within the same workstream execute one at a time. Parallel execution of independent tasks is not yet implemented.
4. **Image generation** — Available via dedicated routes but not deeply integrated into the artifact review flow.
5. **Skill integration** — Tasks reference `requiredSkill` but the execution doesn't yet invoke the AssistantSkill pipeline; it uses raw GPT-4o prompting.
6. **Wiki-aware execution** — The `/command` endpoint uses wiki context for planning, but individual task `/execute` endpoints don't yet inject wiki pages.
