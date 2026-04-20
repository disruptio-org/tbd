# 02 — Domain Model

## Core Entities

### Company
The top-level tenant entity. All data is scoped to a company.

| Field | Description |
|-------|-------------|
| `id` | UUID primary key |
| `name` | Company display name |
| `plan` | Subscription plan (`starter` default) |
| `isActive` | Soft active/deactive flag |
| `language` | UI language (`en`, `pt-PT`, `fr`) |
| `website`, `linkedinUrl` | Used for AI context seeding |
| `webContext` | AI-extracted company context from web scraping |

**Ownership**: A Company owns Users, Documents, Projects, Conversations, CRM data, Tasks, Access Groups, and all AI generation runs/drafts.

**Lifecycle**: Created via Backoffice → Onboarding → Active → Can be deactivated (not deleted).

### User
An authenticated person within a company.

| Field | Description |
|-------|-------------|
| `role` | `MEMBER`, `ADMIN`, or `SUPER_ADMIN` |
| `authProvider` | `EMAIL` or `GOOGLE` |
| `status` | `ACTIVE`, `INACTIVE`, `PENDING` |
| `mustChangePassword` | Set when provisioned by admin |
| `isProvisionedByAdmin` | Tracks admin-created users |

**Business Rules**:
- Email is globally unique across all companies
- `SUPER_ADMIN` can access the Backoffice and manage all companies
- `ADMIN` can manage users and access groups within their company
- `MEMBER` access is determined by their Access Group memberships

### CompanyProfile
Rich structured profile used as AI context for all assistants.

Fields: `companyName`, `description`, `industry`, `productsServices`, `valueProposition`, `targetCustomers`, `targetIndustries`, `markets`, `departments`, `keyProcesses`, `competitors`, `strategicGoals`, `brandTone`.

**Relationship**: One-to-one with Company. Created during onboarding.

### Document
A file uploaded to the company's knowledge base.

| Field | Description |
|-------|-------------|
| `storageKey` | Supabase Storage path |
| `extractedText` | Parsed plaintext content |
| `hash` | SHA-256 content hash for version detection |
| `version` | Integer version number (increments on content changes) |
| `ocrStatus` | OCR lifecycle: `PENDING`, `PROCESSING`, `PROCESSED`, `ERROR` |
| `ocrError` | Error message if OCR processing failed |
| `useAsKnowledgeSource` | Flag for RAG inclusion |
| `knowledgePriority` | `normal`, `preferred`, `critical` |
| `knowledgeCategory` | Optional taxonomy label |
| `folderId` | Optional folder organization |
| `projectId` | Optional project scope |

**Lifecycle**: Upload → Hash Check (duplicate detection or version update) → Text Extraction → Embedding → Available for RAG.

**Versioning Rules**:
- Same filename + same hash → `409 Conflict` (duplicate rejected)
- Same filename + different hash → In-place update, version incremented, old embeddings cleared, OCR reset

### DocumentEmbedding
Vector representation of document chunks for semantic search.

| Field | Description |
|-------|-------------|
| `chunkIndex` | Sequential chunk number |
| `chunkText` | The text content of this chunk |
| `embedding` | 1536-dimension vector (stored as JSON text, but uses pgvector column) |

**Relationship**: Many-to-one with Document. Deleted and regenerated on re-processing.

### Conversation / Message
AI chat conversations and their message history.

| Field | Description |
|-------|-------------|
| `assistantType` | Which assistant: `GENERAL`, `MARKETING`, `SALES`, etc. |
| `brainProfileId` | Optional AI Brain configuration used |
| `messages` | Ordered list of USER/ASSISTANT/SYSTEM messages |

### Project
Client or initiative workspace that scopes documents and task boards.

### AIBrainProfile
Configurable AI personality and behavior per team member. All members are custom-created (no predefined types).

| Field | Description |
|-------|-------------|
| `brainType` | Unique type key per member (e.g., `CUSTOM_MARKETING_LEAD`, `CUSTOM_SALES_REP`) |
| `configJson` | Structured personality/reasoning/output settings |
| `advancedInstructions` | Custom system prompt additions |
| `parentBrainId` | Inheritance chain (`COMPANY` brain is parent for all members) |

**Lifecycle**: DRAFT → ACTIVE → ARCHIVED. Supports versioning via `AIBrainVersion`.

**Sidebar Integration**: Each `AIBrainProfile` record (except `COMPANY`) appears as a sidebar resource link. Deleting a brain removes it from the sidebar.

### AccessGroup / AccessPermissionGrant
RBAC permission system.

| Entity | Purpose |
|--------|---------|
| `AccessGroup` | Named group (e.g., "Marketing Team") |
| `AccessGroupMembership` | User ↔ Group join table |
| `AccessPermissionGrant` | Feature/Sub-feature/Project permission per group |

**Access Levels**: `VIEW`, `USE`, `MANAGE` (hierarchical).

### CrmLead / CrmPipelineStage
Lightweight CRM with pipeline stages, contacts, and activity logs.

**Sources**: `MANUAL`, `LEAD_DISCOVERY`, `API`, `IMPORT`.
**Lifecycle**: `ACTIVE` → `CONVERTED` | `LOST` | `ARCHIVED`.

### Task / TaskBoard / TaskBoardColumn
Kanban-style task management with boards, columns, checklists, comments, watchers, and activity logs.

**Source Types**: Tasks can originate from `MANUAL`, `CHAT_MESSAGE`, `DOCUMENT`, `KNOWLEDGE_GAP`, `PRODUCT_RUN`, `VOICE_AI`, etc.

### Generation Runs & Drafts
Each AI assistant has paired models:
- `<X>GenerationRun`: Records each AI generation with full context (input, output, settings)
- `<X>Draft`: Saved/polished output that the user keeps

Assistants with this pattern: Marketing, Sales, Product, Onboarding, Advisor, GeneralAI.

## Entity Relationship Summary

```
Company (1) ─── (*) User
Company (1) ─── (*) Document ─── (*) DocumentEmbedding
Company (1) ─── (*) Conversation ─── (*) Message
Company (1) ─── (1) CompanyProfile
Company (1) ─── (*) Project
Company (1) ─── (*) TaskBoard ─── (*) Task
Company (1) ─── (*) AccessGroup ─── (*) AccessPermissionGrant
Company (1) ─── (*) CrmPipelineStage ─── (*) CrmLead
Company (1) ─── (*) AIBrainProfile ─── (*) AIBrainVersion
Company (1) ─── (*) CompanyFeature
Company (1) ─── (1) License
Company (1) ─── (1) CompanyOnboardingState
User (*) ─── (*) AccessGroup (via AccessGroupMembership)
```
