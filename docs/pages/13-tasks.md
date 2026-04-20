# 13 — Tasks

## Route
`/tasks`

## Purpose
Full-featured **Kanban task management** system. Multiple boards per project, drag-and-drop columns, rich task detail drawers with checklists, comments, file attachments, labels, and AI voice brief parsing.

## UX Flow
1. Page loads → fetches all boards → loads active board's columns and tasks
2. **Board selector** — switch between boards (linked to projects)
3. **Kanban columns** — drag cards between columns to update status
4. **Task drawer** — click task to open side panel with full details
5. **Create task** — inline creation in any column, or via AI voice brief

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/tasks/boards` | GET | Page load | List all boards | ~300ms |
| `/api/tasks/boards/{id}` | GET | Board selection | Load board columns + tasks | ~400ms |
| `/api/user/team` | GET | Page load | Team members for assignment | ~200ms |
| `/api/tasks/boards` | POST | Create board | New board | ~300ms |
| `/api/tasks/boards/{id}/columns` | POST | Add column | New column | ~200ms |
| `/api/tasks/columns/{id}` | DELETE | Delete column | Remove column | ~200ms |
| `/api/tasks/boards/{id}/columns/reorder` | POST | Drag column | Reorder columns | ~200ms |
| `/api/tasks` | POST | Create task | New task | ~300ms |
| `/api/tasks/{id}/move` | POST | Drag card | Move task between columns | ~200ms |
| `/api/tasks/{id}` | GET | Click task | Load task detail | ~200ms |
| `/api/tasks/{id}` | PATCH | Edit task | Update task fields | ~200ms |
| `/api/tasks/{id}` | DELETE | Delete task | Remove task | ~200ms |
| `/api/tasks/{id}/documents` | POST | Attach file | Upload task attachment | ~1-5s |
| `/api/tasks/{id}/documents?documentId=` | DELETE | Remove file | Delete attachment | ~200ms |
| `/api/tasks/{id}/checklists` | GET/POST | Checklist | CRUD checklists | ~200ms |
| `/api/tasks/{id}/comments` | POST | Comment | Add comment | ~200ms |
| `/api/tasks/{id}/links` | POST | Link content | Link AI generation to task | ~200ms |
| `/api/tasks/{id}/watch` | POST | Watch button | Toggle notifications | ~200ms |
| `/api/tasks/{id}/copy` | POST | Duplicate | Copy task | ~300ms |
| `/api/tasks/boards/{id}` | DELETE | Delete board | Remove entire board | ~300ms |
| `/api/ai/parse-voice-brief` | POST | Voice button | AI parses voice into tasks | ~3-8s |
| `/api/ai/skills?assistantType=` | GET | Skill trigger | Available skills for task type | ~200ms |

## Components & Sections

### Board Selector
- Dropdown with all available boards
- Grouped by project name
- "Create Board" button
- Board settings (rename, delete)

### Kanban Columns
- Drag-and-drop reorderable columns
- Column header: name + task count + add/delete actions
- Inline "Add task" input at bottom of each column
- Cards draggable between columns (DnD Kit library)

### Task Card
- Title, priority color bar, assignee avatar
- Due date badge (red if overdue)
- Label chips (color-coded)
- Checklist progress indicator (if has checklists)
- Click → opens task drawer

### Task Drawer (Side Panel)
- **Header**: title (editable), priority selector, due date picker
- **Description**: rich text editor
- **Assignment**: user dropdown (team members)
- **Labels**: color picker + label name
- **Checklists**: add/remove items, toggle completion
- **Comments**: threaded comments, timestamp, user avatar
- **Attachments**: file upload, preview, download, delete
- **Linked Content**: AI-generated content linked to this task
- **Actions**: Watch, Copy, Delete
- **Activity log**: task history

### Voice Brief
- Microphone button → records audio → Whisper transcription
- AI parses brief into structured tasks (title, description, priority)
- User confirms → tasks created automatically
