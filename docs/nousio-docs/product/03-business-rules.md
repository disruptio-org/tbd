# 03 — Business Rules

## Subscription & Plans

| Rule | Details |
|------|---------|
| Default plan | `starter` (set on Company creation) |
| Plan field | `Company.plan` and `License.plan` |
| License model | One `License` per Company with `startsAt`, `expiresAt`, `isActive` |
| Plan enforcement | Backoffice can toggle `CompanyFeature` per company |
| No self-service billing | Plans changed via Backoffice only |

## Feature Availability

Features are controlled at two levels:

1. **Company Features** (`CompanyFeature` table): Backoffice toggles features on/off per company
2. **Access Permissions** (`AccessPermissionGrant`): Admins configure which user groups can access which features

### Feature Keys (source of truth: `src/lib/permissions.ts`)

```
dashboard, documents, chat, company_advisor, search, marketing, sales,
product_assistant, leads, crm, tasks, projects_workspaces, classifications,
knowledge_gaps, ai_brain, onboarding_assistant, settings, user_management,
access_groups, action_assistant
```

## User Roles & Access

| Role | Scope | Access |
|------|-------|--------|
| `SUPER_ADMIN` | Platform-wide | Full Backoffice access, all features, all companies |
| `ADMIN` | Company | All features within their company, manage users and groups |
| `MEMBER` | Company | Access determined by Access Group memberships |

**Admin override**: Users with `ADMIN` role bypass Access Group restrictions — they get full access to all company features.

## Access Group Rules

- Access levels are hierarchical: `VIEW` < `USE` < `MANAGE`
- A user can belong to multiple groups; permissions are **unioned** (most permissive wins)
- `MANAGE` implies `USE` which implies `VIEW`
- Project scope can be `projects:all` (global) or `projects:<uuid>` (specific)
- System-managed groups (`isSystemManaged: true`) cannot be deleted

## Ownership Rules

| Entity | Owner | Cascade |
|--------|-------|---------|
| User | Company | No cascade (preserves user if company deleted) |
| Document | Company + uploadedBy User | Cascade: Company delete removes all docs |
| Conversation | Company + createdBy User | Cascade on company delete |
| Task | Company + Board + Column | Cascade on board/company delete |
| CRM Lead | Company + owner User | Cascade on company delete; SetNull on user delete |
| AI Brain Profile | Company + createdBy/updatedBy | Cascade on company delete |
| Access Group | Company + createdBy | Cascade on company delete |

## Deletion Behavior

| Action | Behavior |
|--------|----------|
| Delete Company | Cascades to all company data (documents, conversations, tasks, CRM, etc.) |
| Delete User | **Does NOT cascade** — user's created content remains, assignment fields set to null |
| Delete Document | Cascades to DocumentEmbedding records |
| Delete Conversation | Cascades to all Messages in conversation |
| Delete Task Board | Cascades to all Tasks in board |
| Delete Access Group | Cascades to memberships and permission grants |

## Onboarding Rules

- Each company has one `CompanyOnboardingState` tracking wizard progress
- Status flow: `NOT_STARTED` → `IN_PROGRESS` → `COMPLETED`
- Setup wizard has 6 steps: Welcome → Profile → Context → Documents → Review → Complete
- On completion, `onboardingStatus` in User metadata is set to `COMPLETED`
- Users with `mustChangePassword: true` are redirected to `/first-login` before setup

## Document Processing Rules

- Supported formats: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, CSV, TXT, MD, PNG, JPG, JPEG
- Max extraction: text is extracted server-side (pdf-parse for PDF, mammoth for DOCX)
- Embedding: text chunked at ~500 tokens with 50-token overlap, embedded via `text-embedding-3-small`
- Re-processing: deletes existing embeddings, regenerates from current extracted text
- Knowledge priority: `critical` (+0.10 boost), `preferred` (+0.05), `normal` (no boost)

### Content-Based Versioning
- On upload, a SHA-256 hash is computed from file content
- Same filename + same hash → `409 Conflict` (exact duplicate rejected)
- Same filename + different hash → In-place update, version incremented, old embeddings cleared, OCR status reset to `PENDING`

### OCR Lifecycle
- Status field: `ocrStatus` with values `PENDING`, `PROCESSING`, `PROCESSED`, `ERROR`
- Error field: `ocrError` captures processing failure details
- Manual reprocessing: `POST /api/documents/[id]/reprocess` resets status and re-triggers OCR

### Bulk Operations
- Users can select multiple documents (checkbox per row, select-all)
- Bulk actions: Reprocess, Category assignment, Priority assignment, Mark Curated, Delete
- Bulk delete triggers confirmation dialog and deletes selected documents sequentially
- Bulk actions work on both native (`Document`) and external (`ExternalDocument`) records

### External Document Deletion
- External documents (Google Drive, Notion) use `ext-` prefixed IDs
- DELETE endpoint strips `ext-` prefix, verifies ownership via `CompanyIntegration`, then removes from `ExternalDocument` table

## AI Generation Rules

- All generations create a `GenerationRun` record with full context
- Users can save outputs as `Draft` records
- RAG context is injected as a system-level section in the prompt
- Maximum 8 knowledge chunks retrieved per query (configurable)
- Minimum similarity threshold: 0.20 cosine similarity
- Maximum 3 chunks per single document (diversity enforcement)

## CRM Rules

| Rule | Details |
|------|---------|
| Default pipeline stages | Created on first CRM access |
| Lead lifecycle | `ACTIVE` → `CONVERTED` / `LOST` / `ARCHIVED` |
| Lead sources | `MANUAL`, `LEAD_DISCOVERY`, `API`, `IMPORT` |
| Activity tracking | All lead changes logged in `CrmLeadActivity` |
| Contacts | One-to-many per lead, with `isPrimary` flag |

## Email Uniqueness

- User email is globally unique (`@@unique` constraint)
- A user cannot be added to a company if their email exists in another company
- This is enforced at both DB level and API validation level
