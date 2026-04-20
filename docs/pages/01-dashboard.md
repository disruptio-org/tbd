# 01 — Dashboard Home

## Route
`/dashboard`

## Purpose
The **landing page** after login. Shows a personalized overview of the user's workspace: open tasks grouped by project, weekly progress, AI assistant shortcuts, and recent activity feed.

## UX Flow
1. Page loads → shows loading spinner
2. **5 parallel API calls** fire simultaneously
3. Once all resolve → renders full dashboard with:
   - Personalized greeting ("Welcome back, {firstName}")
   - This Week progress strip (if tasks due this week)
   - Open tasks grouped by project/board
   - AI Assistant shortcut buttons
   - Recent activity timeline (docs + conversations)

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/dashboard/my-tasks` | GET | Page load | Open tasks + this week summary | ~400ms |
| `/api/analytics` | GET | Page load | Recent documents & conversations | ~300ms |
| `/api/user/features` | GET | Page load | Filter visible assistants | ~200ms |
| `/api/user/profile` | GET | Page load | User name for greeting | ~200ms |
| `/api/company/profile` | GET | Page load | Company name for subtitle | ~200ms |

## Components & Sections

### Header
- Page title with greeting: "Welcome back, {name}"
- "Ask AI" CTA button → links to `/chat`

### This Week Strip (conditional)
- Only shows if `thisWeek.total > 0`
- Header: "THIS WEEK — N TASKS DUE" + overdue count badge
- Progress bar (completed / total)
- Task chips (up to 4): colored priority dot + title + due date
- Overdue dates highlighted in red

### Open Tasks Section
- Card header: "My Open Tasks" + total count badge
- **Grid layout** — one card per project/board
  - Left border colored by project name (deterministic hash)
  - Project name header with folder icon
  - Task list: priority color bar + title + status label + due date
  - Clicking a task → navigates to `/tasks?boardId={id}`
- **Empty state** if no tasks:
  - Large CheckSquare icon
  - "No open tasks" message
  - "Go to Tasks" CTA button

### AI Assistants Section
- Horizontal row of shortcut buttons
- Filtered by enabled features
- Cards: Marketing, Sales, Product, Company Advisor, Onboarding, Ask AI
- Each button: icon + label → links to respective page

### Recent Activity Section
- Merged timeline of recent documents & conversations (up to 8)
- Each item: type icon + title + relative timestamp (e.g. "3h")
- Documents → link to `/documents`, conversations → link to `/chat`
- Empty state: "No recent activity"
