# 01 — API Spec

## Overview

All API routes are located in `src/app/api/` using Next.js App Router conventions. Each `route.ts` file exports HTTP method handlers (`GET`, `POST`, `PUT`, `DELETE`).

**Base URL**: `/api`
**Auth**: All endpoints (except auth callbacks) require a valid Supabase JWT session cookie.

## Endpoint Catalog

### Authentication (`/api/auth`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/auth/callback` | Handle OAuth callback (Google) | Public |

### User (`/api/user`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/user/profile` | Get current user profile + role | User |
| `PUT` | `/api/user/profile` | Update user profile | User |
| `GET` | `/api/user/language` | Get company language | User |
| `GET` | `/api/user/effective-access` | Resolve effective permissions | User |

### Dashboard (`/api/dashboard`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/dashboard/stats` | Dashboard overview statistics | User |

### Documents (`/api/documents`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/documents` | List documents (optional `?countOnly=true`) | User |
| `POST` | `/api/documents/upload` | Upload document (multipart, SHA-256 hashing, version detection) | User |
| `GET` | `/api/documents/[id]` | Get document detail (supports `ext-` prefixed IDs for external docs) | User |
| `PATCH` | `/api/documents/[id]` | Update document properties (category, priority, curated, folder) | User |
| `DELETE` | `/api/documents/[id]` | Delete document + storage + embeddings (supports `ext-` IDs for external docs) | User |
| `POST` | `/api/documents/[id]/reprocess` | Re-trigger OCR processing (resets `ocrStatus` to `PENDING`) | User |
| `POST` | `/api/documents/[id]/embed` | Trigger embedding generation | User |
| `GET` | `/api/documents/folders` | List document folders | User |
| `POST` | `/api/documents/folders` | Create folder | User |

### Chat (`/api/chat`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/chat/conversations` | List user's conversations | User |
| `POST` | `/api/chat/conversations` | Create new conversation | User |
| `GET` | `/api/chat/conversations/[id]` | Get conversation with messages | User |
| `POST` | `/api/chat/conversations/[id]/messages` | Send message + get AI response | User |

### Company (`/api/company`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/company/profile` | Get company profile | User |
| `PUT` | `/api/company/profile` | Update company profile | User/Admin |

### Growth Assistants
Each assistant module follows the same pattern:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/<module>/runs` | List generation runs |
| `POST` | `/api/<module>/runs` | Create new generation run |
| `GET` | `/api/<module>/drafts` | List saved drafts |
| `POST` | `/api/<module>/drafts` | Save draft |
| `DELETE` | `/api/<module>/drafts/[id]` | Delete draft |

Modules: `marketing`, `sales`, `product`, `company-advisor`, `onboarding-assistant`, `general-ai`

### CRM (`/api/crm`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/crm/pipeline` | Get pipeline stages | User |
| `POST` | `/api/crm/pipeline` | Create/update pipeline stages | Admin |
| `GET` | `/api/crm/leads` | List leads (filterable) | User |
| `POST` | `/api/crm/leads` | Create lead | User |
| `GET` | `/api/crm/leads/[id]` | Get lead detail | User |
| `PUT` | `/api/crm/leads/[id]` | Update lead | User |
| `DELETE` | `/api/crm/leads/[id]` | Delete lead | User |
| `POST` | `/api/crm/leads/[id]/activities` | Add activity/note | User |
| `GET` | `/api/crm/leads/[id]/contacts` | Get lead contacts | User |
| `POST` | `/api/crm/leads/[id]/contacts` | Add contact | User |

### Tasks (`/api/tasks`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/tasks/boards` | List task boards | User |
| `POST` | `/api/tasks/boards` | Create board | User |
| `GET` | `/api/tasks/boards/[id]` | Get board with tasks | User |
| `POST` | `/api/tasks/boards/[id]/tasks` | Create task | User |
| `PUT` | `/api/tasks/[id]` | Update task (column, fields) | User |
| `DELETE` | `/api/tasks/[id]` | Delete task | User |
| `POST` | `/api/tasks/[id]/comments` | Add comment | User |

### Projects (`/api/projects`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/projects` | List projects | User |
| `POST` | `/api/projects` | Create project | User |
| `PUT` | `/api/projects/[id]` | Update project | User |
| `DELETE` | `/api/projects/[id]` | Delete project | Admin |

### Search (`/api/search`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `POST` | `/api/search` | Semantic search across knowledge base | User |

### Onboarding (`/api/onboarding`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/onboarding/state` | Get onboarding wizard state | User |
| `PUT` | `/api/onboarding/state` | Update wizard step/state | User |
| `POST` | `/api/onboarding/complete` | Mark onboarding as completed | User |

### Speech (`/api/speech`)
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `POST` | `/api/speech/transcribe` | Transcribe audio via Whisper | User |

### Backoffice (`/api/backoffice`) — Super Admin only
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/backoffice/companies` | List all companies |
| `POST` | `/api/backoffice/companies` | Create company |
| `GET` | `/api/backoffice/companies/[id]` | Get company detail |
| `PUT` | `/api/backoffice/companies/[id]` | Update company |
| `DELETE` | `/api/backoffice/companies/[id]` | Delete company |
| `GET` | `/api/backoffice/companies/[id]/features` | Get feature toggles |
| `PUT` | `/api/backoffice/companies/[id]/features` | Update feature toggles |
| `GET` | `/api/backoffice/companies/[id]/users` | List company users |
| `POST` | `/api/backoffice/companies/[id]/users` | Create user |

## Authentication Requirements
- **Public**: Only OAuth callbacks
- **User**: Any authenticated user with valid JWT
- **Admin**: Requires `role === 'ADMIN'` within the company
- **Super Admin**: Requires `role === 'SUPER_ADMIN'` (backoffice routes)

## Error Codes

| Status | Meaning |
|--------|---------|
| `400` | Bad Request — missing required fields |
| `401` | Unauthorized — no valid session |
| `403` | Forbidden — insufficient permissions |
| `404` | Not Found — entity doesn't exist |
| `409` | Conflict — duplicate entry |
| `500` | Internal Server Error |

## Response Format
All endpoints return JSON:
```json
// Success
{ "profile": { ... } }
{ "conversations": [...] }
{ "leads": [...], "total": 42 }

// Error
{ "error": "Description of the error" }
```

## Pagination / Filtering
- No standardized pagination across all routes
- Some routes support `?page=&limit=` query params
- CRM leads support `?stage=&status=&search=` filtering
- Documents support `?folderId=` filtering
