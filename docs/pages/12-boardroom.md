# 12 — Boardroom

## Route
`/boardroom` (list) + `/boardroom/[id]` (detail)

## Purpose
**Executive orchestration hub.** Users issue natural language commands, and the Company DNA brain decomposes them into multi-step initiatives with workstreams, tasks, dependencies, and approval gates. The boardroom is where strategic plans are created, reviewed, approved, and tracked.

## UX Flow — List Page (`/boardroom`)
1. Page loads → fetches initiative summary stats + initiative list + projects
2. **Command bar** at top — user types a strategic command (e.g., "Launch a marketing campaign for our new product")
3. AI processes command → returns structured plan preview
4. User reviews plan → clicks "Create Initiative" → saved to database
5. Initiative cards show in grid with status, progress, task counts

## UX Flow — Detail Page (`/boardroom/[id]`)
1. Page loads → fetches initiative details, workstreams, tasks, artifacts, events
2. **Workstream view** — grouped task cards with dependencies
3. **Task execution** — AI generates artifacts (PRDs, wireframes, content)
4. **Approval gates** — certain tasks require human approval before proceeding
5. **Artifact viewer** — fullscreen preview with version history

## API Calls — List Page
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/boardroom/summary` | GET | Page load | Stats (total, in progress, completed) | ~300ms |
| `/api/boardroom/initiatives` | GET | Page load | List all initiatives | ~400ms |
| `/api/projects` | GET | Page load | Project selector for scoping | ~200ms |
| `/api/boardroom/command` | POST | Submit command | AI plan generation | ~8-25s |
| `/api/boardroom/initiatives` | POST | Create button | Save initiative | ~500ms |

## API Calls — Detail Page
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/boardroom/initiatives/{id}` | GET | Page load | Full initiative data | ~400ms |
| `/api/boardroom/initiatives/{id}/tasks` | GET | Page load | Task list | ~300ms |
| `/api/boardroom/initiatives/{id}/tasks/{taskId}/execute` | POST | Execute task | Run AI task | ~5-30s |
| `/api/boardroom/initiatives/{id}/tasks/{taskId}/generate-image` | POST | Generate image | AI image generation | ~10-30s |
| `/api/boardroom/initiatives/{id}/approve` | POST | Approve gate | Approve initiative/task | ~300ms |
| `/api/boardroom/initiatives/{id}/artifacts` | GET | Artifact tab | List artifacts | ~300ms |

## Components & Sections

### Command Bar (List Page)
- Large text input with brain icon
- "Plan this" CTA button
- Loading state: animated planning indicator
- Preview modal for AI-generated plan before saving

### Initiative Grid (List Page)
- Card per initiative: title, status badge, work type icon, progress bar
- Status colors: Draft (gray), Planning (purple), In Progress (blue), Completed (green)
- Click card → navigate to detail page

### Initiative Detail Page
- **Header**: title, status badge, work type, confidence score
- **Workstreams**: collapsible sections with tasks inside
- **Task cards**: assignee badge, status, dependencies, generated output
- **Artifact viewer**: fullscreen markdown/wireframe preview with version tabs
- **Approval panel**: approve/reject buttons with comments
- **Activity timeline**: event log (created, approved, task completed, etc.)

### Plan Preview Modal (List Page)
- Structured view of AI-generated plan
- Objective, business goal, workstreams, tasks, approval gates
- "Create Initiative" / "Discard" buttons
