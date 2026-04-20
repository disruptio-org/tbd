# 23 — Settings (User Profile)

## Route
`/settings`

## Purpose
User profile management. Edit personal information (name, email), language preference, and avatar.

## UX Flow
1. Page loads → fetches user profile
2. User edits fields → "Save" → PATCH call → toast notification

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/user/profile` | GET | Page load | Load user profile | ~200ms |
| `/api/user/profile` | PATCH | Save button | Update profile | ~300ms |

## Components & Sections
- **Profile form**: name, email, avatar upload
- **Language selector**: dropdown with supported locales
- **Save button**: primary CTA

---

# 24 — User Management

## Route
`/settings/users`

## Purpose
Manage company users. Invite new users, assign roles, manage access groups, activate/deactivate accounts. Admin-only page.

## UX Flow
1. Page loads → fetches user list (paginated)
2. "Invite User" → modal with email, name, role
3. Click user → edit modal with role, groups, status
4. Deactivate/reactivate toggle per user
5. View effective access per user

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/company/users` | GET | Page load | List users (paginated) | ~400ms |
| `/api/company/users` | POST | Invite button | Create new user | ~500ms |
| `/api/company/users/{id}` | PATCH | Edit button | Update user | ~300ms |
| `/api/company/users/{id}/deactivate` | POST | Deactivate | Disable user | ~300ms |
| `/api/company/users/{id}/reactivate` | POST | Reactivate | Enable user | ~300ms |
| `/api/company/access-groups` | GET | Load groups | Available access groups | ~200ms |
| `/api/company/users/{id}/groups` | PATCH | Assign groups | Update user's groups | ~300ms |
| `/api/company/users/{id}/effective-access` | GET | View access | Show resolved permissions | ~300ms |

## Components & Sections

### User Table
- Columns: name, email, role badge, status, groups, actions
- Search/filter bar
- Pagination controls

### Invite Modal
- Email input, name input, role selector (MEMBER/ADMIN)
- Sends invitation email on submit

### User Edit Modal
- Role dropdown, group assignment checkboxes
- Status toggle (active/inactive)
- Effective access viewer (resolved permissions tree)

---

# 25 — Access Groups

## Route
`/settings/access-groups`

## Purpose
Configure permission groups for team members. Define which features and sub-features each group can access. MEMBER users require group grants to access features beyond dashboard and chat.

## UX Flow
1. Page loads → fetches all access groups + access metadata
2. Click group → edit panel with feature toggles
3. Create new group → assign features → save

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/company/access-groups` | GET | Page load | List groups | ~300ms |
| `/api/company/access-metadata` | GET | Page load | Feature keys + labels | ~200ms |
| `/api/company/access-groups/{id}` | GET | Click group | Group details | ~200ms |
| `/api/company/access-groups` | POST | Create button | New group | ~300ms |
| `/api/company/access-groups/{id}` | PUT | Save button | Update group rules | ~300ms |
| `/api/company/access-groups/{id}` | DELETE | Delete button | Remove group | ~200ms |

## Components & Sections

### Group List
- Cards: group name, member count, feature count
- "Create Group" button

### Group Editor
- Name input
- Feature toggle grid:
  - Grouped by category (Core, Knowledge, Growth, Execution, Admin)
  - Per-feature toggle (VIEW/USE/MANAGE levels)
  - Sub-feature toggles nested under parent
- Project scope selector (all projects vs. specific)
- Save/cancel buttons

---

# 26 — Integrations

## Route
`/settings/integrations`

## Purpose
Connect external services. Currently supports Google Drive, Notion (OAuth), and Zapier (MCP endpoint). Admin-only.

## UX Flow
1. Page loads → fetches connected integrations
2. "Connect" buttons for each service type
3. OAuth flow for Google/Notion → callback → integration saved
4. Zapier: paste MCP endpoint URL → "Connect" → tools discovered
5. Per integration: sync, disconnect, configure folders

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/integrations` | GET | Page load | List connected integrations | ~300ms |
| `/api/integrations` | POST | Connect button | Create integration | ~500ms-3s (OAuth) |
| `/api/integrations/{id}/sync` | POST | Sync button | Trigger document sync | ~2-30s |
| `/api/integrations/{id}` | DELETE | Disconnect | Remove integration | ~300ms |
| `/api/integrations/{id}/folders` | GET | Settings modal | List available folders | ~500ms |
| `/api/integrations/{id}` | PATCH | Save settings | Update sync folders | ~300ms |

## Components & Sections

### Integration Cards
- Card per service: Google Drive, Notion, Zapier
- Status: Connected (green) / Not Connected (gray)
- Action count, last sync date
- Sync / Settings / Disconnect buttons

### Connect Flow
- **Google Drive/Notion**: OAuth popup → redirect → callback
- **Zapier**: Input field for MCP endpoint → test connection → save

### Settings Modal
- Folder selector (Google Drive)
- Sync schedule options
- Document filter settings
