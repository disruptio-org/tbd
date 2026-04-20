# 04 — Feature Flows

## 1. Company Onboarding

**Trigger**: New user logs in for the first time after company creation.

**Steps**:
1. User authenticates (Supabase Auth)
2. `ensureDbUser()` creates/syncs DB User record
3. Check `onboardingStatus` — if not `COMPLETED`, redirect to `/setup`
4. If `mustChangePassword`, redirect to `/first-login` first
5. Setup Wizard (6 steps):
   - **Welcome**: Overview of the process
   - **Profile**: Company name, industry, website, description, products, value proposition
   - **Context**: Target customers, markets, departments, processes, competitors, goals
   - **Documents**: Upload initial documents (auto-processed: extract text → chunk → embed)
   - **Review**: Summary of profile + document count + optional AI guide generation
   - **Complete**: Quick action shortcuts to Chat, Documents, Profile, Onboarding Assistant
6. On completion, `POST /api/onboarding/complete` sets status to `COMPLETED`
7. User redirected to `/dashboard`

**Services**: `auth.ts`, `user.ts`, Onboarding API routes, Document upload pipeline
**Data Created**: `CompanyProfile`, `CompanyOnboardingState`, `Document`, `DocumentEmbedding`, optional `CompanyOnboardingGuide`
**Edge Cases**: User refreshes mid-step (state persisted via `CompanyOnboardingState`), documents fail upload (individual error per file)

---

## 2. Document Upload & Knowledge Indexing

**Trigger**: User uploads a file via Documents page or Setup wizard.

**Steps**:
1. File sent via `POST /api/documents/upload` as `multipart/form-data`
2. SHA-256 hash computed from file content
3. **Duplicate / Version Check**:
   - If same filename + same hash exists → return `409 Conflict` (duplicate rejected)
   - If same filename + different hash exists → update in-place: increment `version`, clear old embeddings, reset `ocrStatus` to `PENDING`
   - If new filename → create new `Document` record (version 1)
4. File stored in Supabase Storage at `documents/{companyId}/{uuid}-{filename}`
5. Text extraction based on MIME type:
   - PDF → `pdf-parse`
   - DOCX → `mammoth`
   - Plain text/Markdown → direct read
   - Images → OCR (if enabled), sets `ocrStatus` through lifecycle: `PENDING` → `PROCESSING` → `PROCESSED` / `ERROR`
6. If text extraction succeeds, `extractedText` saved; `ocrStatus` updated
7. `embedDocument()` called:
   - Text chunked (500 tokens, 50 overlap)
   - Embeddings generated via `text-embedding-3-small`
   - Stored in `DocumentEmbedding` table
8. Document available for RAG retrieval

**Reprocessing**: Users can manually re-trigger OCR via `POST /api/documents/[id]/reprocess` for documents with `ERROR` status. This resets `ocrStatus` to `PENDING` and clears `ocrError`.

**Failure Points**: Supabase Storage unavailable, text extraction fails (binary file), OpenAI quota exceeded, OCR processing errors (captured in `ocrError`)

---

## 2b. External Document Sync (Google Drive / Notion)

**Trigger**: Admin connects a provider in Settings → Integrations, then clicks "Sync Now" or automatic schedule runs.

**Steps (Google Drive)**:
1. Admin initiates OAuth flow from Settings → Integrations
2. `CompanyIntegration` record created with OAuth tokens and provider `GOOGLE_DRIVE`
3. Admin selects folders to sync in Settings
4. On sync trigger, `syncIntegration()` runs:
   a. Load `CompanyIntegration` → get adapter via `getAdapter(provider)`
   b. For each selected folder → `adapter.listFiles(tokens, folderId)`
   c. For each file → `adapter.downloadFile()` → `extractTextFromBuffer()` → `embedDocument()`
   d. Store in `ExternalDocument` with content hash for dedup
5. Documents appear in Documents page under "Google Drive" tab

**Steps (Notion)**:
1. Admin pastes Notion Internal Integration Token in Settings → Integrations
2. `CompanyIntegration` record created with token and provider `NOTION`
3. On sync trigger, auto-discovery runs:
   a. `adapter.listFolders()` discovers all accessible pages (no folder selection needed)
   b. Selected folders auto-populated in `CompanyIntegration.config`
   c. For each page → `adapter.downloadFile()` converts to Markdown via `notion-to-md`
   d. If `notion-to-md` returns empty, fallback extracts text from Notion Blocks API
   e. Store in `ExternalDocument`, generate embeddings
4. Documents appear in Documents page under "Notion" tab

**Data Created**: `CompanyIntegration`, `ExternalDocument`, `DocumentEmbedding`
**Adapter Pattern**: All providers implement `DocumentSourceAdapter` (types.ts)
**Dedup**: Content hash prevents re-embedding unchanged files

---

## 3. AI Content Generation (General Flow)

**Trigger**: User submits a prompt in any Growth Assistant.

**Steps**:
1. User types/speaks input in assistant UI
2. Frontend sends `POST /api/<assistant>/generate` or `POST /api/<assistant>/runs`
3. Backend:
   a. Authenticate user (`getCurrentUser()`)
   b. Load company profile for context injection
   c. Call `retrieveRelevantKnowledge(companyId, query)` for RAG
   d. Check for AI Brain overrides (`AIBrainProfile` config)
   e. Construct system prompt with company context + RAG chunks + brain instructions
   f. Call OpenAI Chat Completion (`gpt-4o-mini` or `gpt-4o` depending on brain config)
   g. Stream or return response
4. Create `<X>GenerationRun` record in DB
5. Display response with markdown rendering
6. User can optionally save as `<X>Draft`

**Services**: `rag-retrieval.ts`, `embeddings.ts`, `assistant-generate.ts`, `openai.ts`, AI Brain config
**Edge Cases**: Empty knowledge base (no RAG context), very long responses, rate limiting

---

## 4. Ask AI Chat

**Trigger**: User opens a new or existing chat conversation.

**Steps**:
1. Frontend loads/creates conversation via `/api/chat/conversations`
2. User sends message → `POST /api/chat/conversations/[id]/messages`
3. Backend:
   a. Save USER message to `Message` table
   b. Load conversation history
   c. Execute RAG retrieval for user's latest message
   d. Build system prompt with company context, brain config, RAG chunks
   e. Call OpenAI with message history
   f. Save ASSISTANT message to `Message` table
4. Response streamed back to frontend
5. `AssistantQuestionLog` created for grounding tracking

---

## 5. CRM Lead Management

**Trigger**: User creates a lead manually or via Lead Discovery.

**Steps**:
1. Create lead: `POST /api/crm/leads` with lead details
2. Default pipeline stages created if first-time access
3. Lead placed in first pipeline stage
4. User can:
   - Update lead details (name, company, contact info)
   - Move between pipeline stages (drag-and-drop)
   - Add notes, contacts, change owner
   - Mark as Converted/Lost/Archived
5. All changes logged in `CrmLeadActivity`

---

## 6. Task Board Management

**Trigger**: User creates or opens a task board.

**Steps**:
1. Create board: `POST /api/tasks/boards` with columns
2. Add tasks to columns with title, description, priority, assignee
3. Drag tasks between columns (position and column updates)
4. Tasks support: checklists, comments, watchers, labels, cover colors, linked documents
5. All changes logged in `TaskActivity`
6. Tasks can be created from other modules (chat, knowledge gaps, AI drafts)

---

## 7. Access Control Resolution

**Trigger**: User logs in or navigates to a feature.

**Steps**:
1. Frontend calls `/api/user/effective-access`
2. Backend (`resolveEffectiveAccess()`):
   a. Load user role and status
   b. If `ADMIN` or `SUPER_ADMIN`: return full access (all features, all projects)
   c. If `MEMBER`: build baseline (minimal access)
   d. Load all active `AccessGroupMembership` for user
   e. Load all `AccessPermissionGrant` for those groups
   f. Union all feature and sub-feature permissions (most permissive wins)
   g. Resolve project scope (union of allowed projects)
3. Return `EffectiveAccess` object
4. Frontend uses it to show/hide sidebar items and feature gates

---

## 8. Knowledge Gap Detection

**Trigger**: Every AI assistant response is evaluated.

**Steps**:
1. Each question logged in `AssistantQuestionLog` with `groundingStatus`
2. Periodic analysis groups questions by topic
3. Questions with `NOT_FOUND` or `PARTIAL` grounding create/update `KnowledgeGap` records
4. Knowledge Gaps page shows gaps with frequency, score, example questions
5. Users can mark as resolved or ignored
6. System suggests what documents/information to add
