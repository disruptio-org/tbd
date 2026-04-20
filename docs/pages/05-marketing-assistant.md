# 05 — Marketing Assistant

## Route
`/marketing`

## Purpose
AI-powered marketing content generator. Creates LinkedIn posts, blog drafts, newsletters, website copy, content calendars, service descriptions, and more. Uses wiki-first RAG retrieval for company-grounded output.

## UX Flow
1. Page loads → fetches generation history
2. User selects content type from toolbar (e.g., "LinkedIn Post")
3. Fills in topic, audience, tone, length, language
4. Clicks "Generate" → streaming AI response
5. Output renders in rich markdown with copy/save actions
6. History sidebar shows past generations (click to reload, delete)
7. "Create Task" button converts output to a task on a Kanban board

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/marketing/history` | GET | Page load | Load generation history | ~300ms |
| `/api/marketing/generate` | POST | Generate button | AI content generation | ~5-20s |
| `/api/marketing/history/{id}` | GET | Click history item | Load past generation | ~200ms |
| `/api/marketing/history` | DELETE | Delete button | Delete history item | ~200ms |
| `/api/tasks/{id}/links` | POST | "Create Task" | Link generation to task | ~300ms |

## Components & Sections

### Content Type Toolbar
- Horizontal scrollable tabs: LinkedIn Post, Blog Draft, Newsletter, Website Copy, Content Calendar, Service Description, Campaign Idea, Social Media Plan
- Each tab sets the `contentType` for generation

### Generation Form
- **Topic** — free text input (main prompt)
- **Audience** — target audience selector
- **Tone** — dropdown (professional, friendly, formal, etc.)
- **Length** — short / medium / long
- **Language** — auto-detected or manual selection
- **Generate button** — primary CTA, disabled during generation

### Output Panel
- Rich markdown rendering (headers, lists, bold, links)
- Copy to clipboard button
- "Create Task" button (opens task creation modal)
- Loading state: animated dots during generation

### History Sidebar
- Scrollable list of past generations
- Each item: title, content type badge, date, delete icon
- Click to reload into output panel
- Delete with confirmation dialog

### Grounding Status
- Badge showing whether output was grounded in company knowledge:
  - VERIFIED (green) — wiki + RAG context used
  - PARTIAL (yellow) — some context found
  - NOT_FOUND (gray) — general knowledge only
