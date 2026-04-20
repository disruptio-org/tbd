# 14 — Projects & Workspaces

## Route
`/projects` (list) + `/projects/[id]` (detail)

## Purpose
Project management for organizing work. Each project can have its own documents, tasks, knowledge scope, and context. Projects scope the AI's knowledge for more relevant outputs.

## UX Flow
1. Page loads → fetches project list
2. User can create, edit, or delete projects
3. Click project → detail page with context, documents, tasks

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/projects` | GET | Page load | List all projects | ~300ms |
| `/api/projects` | POST | Create button | New project | ~300ms |
| `/api/projects/{id}` | PUT | Save button | Update project | ~300ms |
| `/api/projects/{id}` | DELETE | Delete button | Remove project | ~200ms |

## Components & Sections

### Project List
- Card grid: project name, description, icon, document count
- "Create Project" button
- Click card → navigate to detail

### Project Detail (`/projects/[id]`)
- Editable name, description, context text
- Documents tab (project-scoped)
- Tasks boards tab
- Knowledge scope (project-specific DNA)

---

# 15 — Customers

## Route
`/customers` (list) + `/customers/[id]` (detail)

## Purpose
Customer/client management. Each customer can have their own knowledge scope, documents, and AI context. Used to personalize AI outputs per client.

## UX Flow
1. Page loads → fetches customer list
2. User can create, edit, delete customers
3. Click customer → detail page with profile and documents

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/customers` | GET | Page load | List all customers | ~300ms |
| `/api/customers` | POST | Create button | New customer | ~300ms |
| `/api/customers/{id}` | GET/PUT/DELETE | Detail page | CRUD customer | ~200-300ms |

## Components & Sections

### Customer List
- Table/grid: name, industry, contact count, last updated
- "Add Customer" button
- Search/filter bar

### Customer Detail (`/customers/[id]`)
- Profile fields: name, website, industry, description
- Customer-specific documents
- Customer-specific knowledge scope

---

# 16 — CRM

## Route
`/crm`

## Purpose
Sales pipeline management with a Kanban-style deal board. Track leads through pipeline stages, log activities, and manage deals.

## UX Flow
1. Page loads → fetches pipeline stages + leads
2. Auto-creates default pipeline if none exists
3. Drag leads between pipeline stages
4. Click lead → detail drawer with activities, contact info, notes

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/crm/pipeline` | GET | Page load | Load pipeline stages | ~300ms |
| `/api/crm/pipeline` | POST | Auto-create | Create default pipeline | ~300ms |
| `/api/crm/pipeline` | PUT | Edit stages | Update pipeline | ~300ms |
| `/api/crm/leads?stage=...` | GET | Stage filter | Load leads | ~400ms |
| `/api/crm/leads` | POST | Create lead | New lead | ~300ms |
| `/api/crm/leads/{id}` | GET | Click lead | Load lead detail | ~200ms |
| `/api/crm/leads/{id}` | PATCH | Edit lead | Update lead fields | ~200ms |
| `/api/crm/leads/{id}` | DELETE | Delete lead | Remove lead | ~200ms |
| `/api/crm/leads/{id}/activities` | POST | Log activity | Add activity entry | ~200ms |
| `/api/company` | GET | Page load | Company info for context | ~200ms |

## Components & Sections

### Pipeline Board
- Kanban columns per pipeline stage
- Lead cards: company name, value, contact, last activity
- Drag between stages

### Lead Detail Drawer
- Contact info, company, deal value
- Activity timeline: calls, emails, meetings, notes
- Log activity form
- Edit/delete buttons
