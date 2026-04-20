# Disruptio — Solution Requirements Document

> **Version**: 1.0  
> **Date**: 2026-03-09  
> **Status**: Current Implementation

---

## Table of Contents

1. [Business Requirements](#1-business-requirements)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [Technical Requirements](#4-technical-requirements)

---

## 1. Business Requirements

### 1.1 Product Vision

Disruptio is an **AI Starter Kit for SMEs (PMEs)** — a multi-tenant SaaS platform that enables small and medium enterprises to leverage artificial intelligence for document management, text extraction, intelligent search, and AI-powered conversations over their business documents.

### 1.2 Target Audience

| Segment | Description |
|---------|-------------|
| **Primary** | Small and medium enterprises (PMEs) in Portugal and Portuguese-speaking markets |
| **Secondary** | Consultants and digital transformation teams managing multiple companies |
| **Admin** | Platform Super Administrators managing companies, licenses, and features |

### 1.3 Business Objectives

| ID | Objective | Status |
|----|-----------|--------|
| BO-1 | Provide a centralized document management system with AI capabilities | ✅ Implemented |
| BO-2 | Enable natural language search over uploaded business documents | ✅ Implemented |
| BO-3 | Offer AI-powered conversational interface for document analysis | ✅ Implemented |
| BO-4 | Support automated text extraction (OCR) from PDFs, DOCX, and images | ✅ Implemented |
| BO-5 | Provide a multi-tenant platform with per-company data isolation | ✅ Implemented |
| BO-6 | Offer an admin backoffice for managing companies, licenses, and features | ✅ Implemented |
| BO-7 | Support multiple authentication methods (Email + Google OAuth) | ✅ Implemented |
| BO-8 | Deliver a Portuguese-localized interface (PT-PT) | ✅ Implemented |

### 1.4 Business Rules

| ID | Rule |
|----|------|
| BR-1 | Every user belongs to exactly one company |
| BR-2 | New users registering via login automatically get a new company created |
| BR-3 | Documents, conversations, and all data are scoped to the user's company |
| BR-4 | Only SUPER_ADMIN users can access the backoffice |
| BR-5 | Companies have subscription plans: Starter, Pro, Enterprise |
| BR-6 | Features can be individually toggled per company via backoffice |
| BR-7 | Companies can be deactivated without deleting their data |

---

## 2. Functional Requirements

### 2.1 Authentication & User Management

| ID | Requirement | Status |
|----|-------------|--------|
| FR-AUTH-1 | Users can register with email and password | ✅ Implemented |
| FR-AUTH-2 | Users can log in with email and password | ✅ Implemented |
| FR-AUTH-3 | Users can log in with Google OAuth | ✅ Implemented |
| FR-AUTH-4 | Authentication state is persisted via session cookies (Supabase SSR) | ✅ Implemented |
| FR-AUTH-5 | First-time login auto-provisions a User + Company record in PostgreSQL | ✅ Implemented |
| FR-AUTH-6 | Users can log out from the dashboard sidebar | ✅ Implemented |
| FR-AUTH-7 | Google OAuth callback redirects to dashboard after authentication | ✅ Implemented |

**Auto-Provisioning Flow:**
1. User authenticates via Supabase Auth (email or Google)
2. `ensureDbUser()` checks if a `User` record exists in DB by email
3. If not found: creates a new `Company` + `User` record automatically
4. Google users get `authProvider: GOOGLE`; email users get `authProvider: EMAIL`
5. New users are assigned `role: ADMIN` for their company

---

### 2.2 Document Management

| ID | Requirement | Status |
|----|-------------|--------|
| FR-DOC-1 | Users can upload documents (PDF, DOCX, images) up to 50MB | ✅ Implemented |
| FR-DOC-2 | Upload supports both button click and drag-and-drop | ✅ Implemented |
| FR-DOC-3 | Uploaded files are stored in Supabase Storage (private bucket) | ✅ Implemented |
| FR-DOC-4 | Document metadata is stored in PostgreSQL (filename, size, mimeType, etc.) | ✅ Implemented |
| FR-DOC-5 | Users can view a list of their company's documents in a table | ✅ Implemented |
| FR-DOC-6 | Document table shows: filename, type, size, OCR status, date, actions | ✅ Implemented |
| FR-DOC-7 | Users can delete documents (with in-app confirmation modal) | ✅ Implemented |
| FR-DOC-8 | Deleting a document removes its DB record and associated embeddings | ✅ Implemented |
| FR-DOC-9 | Users can trigger OCR processing on individual documents | ✅ Implemented |
| FR-DOC-10 | Users can view original PDF documents in an embedded viewer (iframe) | ✅ Implemented |
| FR-DOC-11 | Documents are scoped to the user's company (multi-tenant) | ✅ Implemented |

**Supported File Formats:**

| Format | Extensions | MIME Types |
|--------|-----------|------------|
| PDF | `.pdf` | `application/pdf` |
| Word | `.doc`, `.docx` | `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Images | `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp` | `image/png`, `image/jpeg`, `image/tiff`, `image/bmp` |

---

### 2.3 OCR / Text Extraction

| ID | Requirement | Status |
|----|-------------|--------|
| FR-OCR-1 | System extracts text from PDF documents using `pdf-parse` library | ✅ Implemented |
| FR-OCR-2 | System extracts text from DOCX files using `mammoth` library | ✅ Implemented |
| FR-OCR-3 | System extracts text from images using OpenAI GPT-4o Vision API | ✅ Implemented |
| FR-OCR-4 | Fallback: PDFs that fail local parsing are sent to OpenAI for extraction | ✅ Implemented |
| FR-OCR-5 | Extracted text is stored in the `extractedText` field of the Document | ✅ Implemented |
| FR-OCR-6 | OCR status is tracked via `ocrProcessed` boolean flag | ✅ Implemented |
| FR-OCR-7 | After OCR, the text is automatically chunked and embeddings are generated | ✅ Implemented |
| FR-OCR-8 | Embeddings are stored in the `DocumentEmbedding` table for search | ✅ Implemented |

**Extraction Pipeline:**

```
Document Upload → Manual Trigger "Executar OCR"
                          │
            ┌─────────────┼─────────────────┐
            ▼             ▼                 ▼
        PDF (pdf-parse)  DOCX (mammoth)  Image (GPT-4o Vision)
            │             │                 │
            └─────────────┼─────────────────┘
                          ▼
                  extractedText → DB
                          │
                          ▼
         chunkText() → generateEmbeddings() → DocumentEmbedding table
```

**Embedding Pipeline:**
- Text is split into ~500-word chunks with 50-word overlap
- Embeddings generated via OpenAI `text-embedding-3-small` model (1536 dimensions)
- Stored as JSON strings in the `DocumentEmbedding` table
- Old embeddings for a document are deleted before re-processing (idempotent)

---

### 2.4 Intelligent Search

| ID | Requirement | Status |
|----|-------------|--------|
| FR-SEARCH-1 | Users can search documents using natural language queries | ✅ Implemented |
| FR-SEARCH-2 | Search uses vector similarity (embeddings cosine similarity) as primary method | ✅ Implemented |
| FR-SEARCH-3 | Search falls back to text-based ILIKE search when no embeddings exist | ✅ Implemented |
| FR-SEARCH-4 | Results can be filtered by file type (PDF, DOCX, Images) | ✅ Implemented |
| FR-SEARCH-5 | Results can be filtered by date range (from/to) | ✅ Implemented |
| FR-SEARCH-6 | Each result shows a relevance percentage score | ✅ Implemented |
| FR-SEARCH-7 | AI-generated contextual summaries are provided for each result | ✅ Implemented |
| FR-SEARCH-8 | Users can click "Ver documento e conversar com IA" to open the document viewer modal | ✅ Implemented |
| FR-SEARCH-9 | Results are scoped to the user's company (multi-tenant) | ✅ Implemented |

**Search Architecture:**
1. Generate embedding for the user's query via `text-embedding-3-small`
2. Fetch all `DocumentEmbedding` records for the company
3. Compute cosine similarity in-app between query embedding and document chunk embeddings
4. Return top results ranked by similarity score
5. Use GPT-4o-mini to generate contextual summaries for each result

---

### 2.5 AI Chat

| ID | Requirement | Status |
|----|-------------|--------|
| FR-CHAT-1 | Users can have AI conversations about their documents | ✅ Implemented |
| FR-CHAT-2 | Chat uses RAG (Retrieval-Augmented Generation) with document embeddings | ✅ Implemented |
| FR-CHAT-3 | Conversations are persisted in the database (Conversation + Message tables) | ✅ Implemented |
| FR-CHAT-4 | Users can create new conversations | ✅ Implemented |
| FR-CHAT-5 | Users can view and resume past conversations from a sidebar | ✅ Implemented |
| FR-CHAT-6 | Users can delete conversations (with in-app confirmation modal) | ✅ Implemented |
| FR-CHAT-7 | Chat responses include source document references | ✅ Implemented |
| FR-CHAT-8 | Document sources are clickable — opens the Document Viewer Modal | ✅ Implemented |
| FR-CHAT-9 | Source documents are deduplicated in the response | ✅ Implemented |
| FR-CHAT-10 | Chat messages render markdown (bold, lists, paragraphs) | ✅ Implemented |
| FR-CHAT-11 | Speech-to-text input with auto language detection | ✅ Implemented |
| FR-CHAT-12 | File upload support in chat interface | ✅ Implemented |

**Chat RAG Pipeline:**
1. User sends message
2. System generates embedding for the query
3. Finds most relevant document chunks via cosine similarity
4. Builds a system prompt with the relevant chunks as context
5. Calls OpenAI GPT-4o-mini for the response
6. Returns the answer and source documents

---

### 2.6 Document Viewer Modal

| ID | Requirement | Status |
|----|-------------|--------|
| FR-VIEWER-1 | Modal opens on top of current page (search or chat) without navigation | ✅ Implemented |
| FR-VIEWER-2 | Left panel displays the original PDF/image via embedded iframe | ✅ Implemented |
| FR-VIEWER-3 | Non-PDF/image documents show a text fallback | ✅ Implemented |
| FR-VIEWER-4 | Right panel provides a document-specific AI chat interface | ✅ Implemented |
| FR-VIEWER-5 | Document chat uses the full `extractedText` as context | ✅ Implemented |
| FR-VIEWER-6 | Speech-to-text with auto language detection in the document chat | ✅ Implemented |
| FR-VIEWER-7 | Modal can be closed via ✕ button, clicking overlay, or Escape key | ✅ Implemented |

---

### 2.7 Dashboard

| ID | Requirement | Status |
|----|-------------|--------|
| FR-DASH-1 | Dashboard shows summary statistics: Documents, Pesquisas, Conversas IA | ✅ Implemented |
| FR-DASH-2 | Statistics are fetched from the analytics API in real-time | ✅ Implemented |
| FR-DASH-3 | Quick access cards link to: Gerir Documentos, Pesquisa Inteligente, Chat IA | ✅ Implemented |
| FR-DASH-4 | Stats reflect the current user's company data only (multi-tenant) | ✅ Implemented |

---

### 2.8 Backoffice (Admin Panel)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-BO-1 | Only SUPER_ADMIN users can access the backoffice (`/backoffice`) | ✅ Implemented |
| FR-BO-2 | Admin can view all companies in a searchable, filterable table | ✅ Implemented |
| FR-BO-3 | Admin can create new companies (name, email, plan) | ✅ Implemented |
| FR-BO-4 | Admin can delete companies with in-app confirmation | ✅ Implemented |
| FR-BO-5 | Admin can edit company details (name, email, plan, active status) | ✅ Implemented |
| FR-BO-6 | Admin can toggle individual features per company | ✅ Implemented |
| FR-BO-7 | Admin can manage company licenses (plan, expiration, active status) | ✅ Implemented |
| FR-BO-8 | Admin can view and change user roles within a company | ✅ Implemented |
| FR-BO-9 | Admin can filter companies by plan type (Starter, Pro, Enterprise) | ✅ Implemented |
| FR-BO-10 | Backoffice has dedicated analytics dashboard | ✅ Implemented |

**Available Feature Toggles:**

| Feature Key | Label |
|-------------|-------|
| `documents` | Gestão de Documentos |
| `ocr` | OCR / Extração de Texto |
| `search` | Pesquisa Inteligente |

---

## 3. Non-Functional Requirements

### 3.1 Security

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-SEC-1 | All API routes require authentication via Supabase session cookies | Server-side cookie validation via `@supabase/ssr` |
| NFR-SEC-2 | Backoffice routes require SUPER_ADMIN role | `requireSuperAdmin()` middleware function |
| NFR-SEC-3 | Document storage uses private buckets (not publicly accessible) | Supabase Storage `{ public: false }` |
| NFR-SEC-4 | Multi-tenant data isolation: users can only access their company's data | All queries filter by `companyId` |
| NFR-SEC-5 | API keys stored as environment variables, never exposed to client | `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| NFR-SEC-6 | Admin client uses service role key for privileged operations | `createAdminClient()` with service role |
| NFR-SEC-7 | Google OAuth token exchange happens server-side | Auth callback route handles token exchange |

### 3.2 Performance

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-PERF-1 | Document upload max file size: 50MB | Validated client-side |
| NFR-PERF-2 | Embedding chunks: ~500 words with 50-word overlap | Optimized for embedding model context |
| NFR-PERF-3 | Chat model: GPT-4o-mini for fast, cost-efficient responses | Balance of quality and speed |
| NFR-PERF-4 | Vector search computes cosine similarity in-app | No dependency on pgvector extension |
| NFR-PERF-5 | Dashboard stats fetched on page load with error fallback | `catch(console.error)` prevents UI failures |

### 3.3 Usability

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-UX-1 | Interface fully localized in Portuguese (PT-PT) | All labels, messages, placeholders in Portuguese |
| NFR-UX-2 | Responsive sidebar with mobile toggle | Sidebar collapses on mobile with hamburger menu |
| NFR-UX-3 | Drag-and-drop file upload support | Drop zone with visual feedback |
| NFR-UX-4 | In-app confirmation modals (no browser popups) | `UIFeedbackProvider` with `showConfirm()` |
| NFR-UX-5 | In-app toast notifications for alerts | `UIFeedbackProvider` with `showToast()` |
| NFR-UX-6 | Speech-to-text with auto language detection | Web Speech API integration |
| NFR-UX-7 | Markdown rendering in chat messages | Custom `renderMarkdown()` function |
| NFR-UX-8 | Keyboard shortcuts: Enter to send, Shift+Enter for new line, Escape to close modals | Event handlers on key components |

### 3.4 Reliability

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-REL-1 | OCR pipeline has multiple fallback strategies | pdf-parse → OpenAI Vision fallback for PDFs |
| NFR-REL-2 | Search has text-based fallback when no embeddings exist | ILIKE text search as fallback |
| NFR-REL-3 | Embedding pipeline is idempotent (deletes old before re-inserting) | `embedDocument()` deletes existing first |
| NFR-REL-4 | API errors return structured JSON with appropriate HTTP status codes | Consistent error response format |

### 3.5 Scalability

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-SCALE-1 | Multi-tenant architecture with company-scoped data | `companyId` on all major tables |
| NFR-SCALE-2 | Database indexed on common query patterns | `@@index` directives on frequently filtered columns |
| NFR-SCALE-3 | Embedding storage supports re-processing | Delete + re-insert pattern |

---

## 4. Technical Requirements

### 4.1 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router) | 16.1.6 |
| **Frontend** | React | 19.2.3 |
| **Language** | TypeScript | 5.x |
| **Styling** | Vanilla CSS (custom design system) | — |
| **Authentication** | Supabase Auth + SSR | `@supabase/ssr` 0.9.0 |
| **Database** | PostgreSQL (via Supabase) | — |
| **ORM / Schema** | Prisma (schema definition only) | 7.4.2 |
| **Data Access** | Supabase JavaScript Client (Data API) | `@supabase/supabase-js` 2.98.0 |
| **File Storage** | Supabase Storage | — |
| **AI / LLM** | OpenAI API | `openai` 6.25.0 |
| **PDF Parsing** | pdf-parse | 2.4.5 |
| **DOCX Parsing** | mammoth | 1.11.0 |
| **Charts** | Recharts | 3.7.0 |
| **Validation** | Zod | 4.3.6 |
| **Drag & Drop** | dnd-kit | core 6.3.1, sortable 10.0.0 |
| **Testing** | Playwright | 1.58.2 |

### 4.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │Dashboard │  │Documents │  │ Search   │  │   Chat IA     │  │
│  │ page.tsx │  │ page.tsx │  │ page.tsx │  │   page.tsx    │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐  │
│  │   Backoffice    │  │  Shared: UIFeedback, DocumentViewer │  │
│  │   (admin only)  │  │  Modal, Providers                   │  │
│  └─────────────────┘  └─────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ API Routes (Next.js)
┌────────────────────────────┼────────────────────────────────────┐
│                         BACKEND                                 │
│                                                                 │
│  /api/analytics         ─ Dashboard statistics                  │
│  /api/auth/callback     ─ OAuth callback handler                │
│  /api/chat              ─ AI chat with RAG pipeline             │
│  /api/chat/conversations─ CRUD for conversations                │
│  /api/documents/upload  ─ File upload to Supabase Storage       │
│  /api/documents/[id]    ─ Document CRUD + download              │
│  /api/documents/[id]/chat ─ Document-specific AI chat           │
│  /api/ocr               ─ OCR text extraction pipeline          │
│  /api/search            ─ Semantic + text search                │
│  /api/backoffice/*      ─ Admin company/feature/license CRUD    │
│                                                                 │
│  lib/auth.ts            ─ Authentication helpers                │
│  lib/user.ts            ─ User/company auto-provisioning        │
│  lib/embeddings.ts      ─ Chunking + embedding pipeline         │
│  lib/openai.ts          ─ OpenAI client initialization          │
│  lib/supabase/*         ─ Supabase client factories             │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Supabase   │  │   Supabase   │  │     OpenAI API       │  │
│  │   Auth       │  │   PostgreSQL │  │                      │  │
│  │              │  │   + Storage  │  │  - GPT-4o-mini       │  │
│  │  Email/OAuth │  │              │  │  - GPT-4o (Vision)   │  │
│  │              │  │              │  │  - text-embedding-   │  │
│  │              │  │              │  │    3-small           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Model

The application uses **16 Prisma models** organized into the following domains:

#### Core Models (Active)

| Model | Purpose | Key Relationships |
|-------|---------|-------------------|
| `Company` | Multi-tenant organization | Has many Users, Documents, Conversations |
| `User` | Platform user with role-based access | Belongs to Company; can be MEMBER, ADMIN, or SUPER_ADMIN |
| `Document` | Uploaded file metadata | Belongs to Company + User; has many DocumentEmbeddings |
| `DocFolder` | Hierarchical folder structure | Self-referential parent/child tree |
| `DocumentEmbedding` | Vector chunks for semantic search | Belongs to Document; stores chunked text + embedding vector |
| `Conversation` | AI chat conversation | Belongs to Company + User; has many Messages |
| `Message` | Individual chat message | Role: USER, ASSISTANT, or SYSTEM |
| `CompanyFeature` | Per-company feature toggle | Unique constraint on (companyId, featureKey) |
| `License` | Company subscription license | One-to-one with Company; tracks plan/expiry |

#### Schema Models (Defined but not actively used in frontend)

| Model | Purpose |
|-------|---------|
| `DiagnosticAssessment` | Digital maturity assessments |
| `UseCase` | Industry use case examples |
| `DataQualityJob` | Data validation/cleaning jobs |
| `GovernanceTemplate` | Compliance/RGPD templates |
| `Workflow` + `WorkflowRun` | Automation workflows |
| `UsageMetric` | Platform usage analytics |
| `SupportTicket` | Customer support tickets |

### 4.4 Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key (client-side auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side admin operations) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for Chat, Search, OCR, and Embeddings |

### 4.5 API Routes Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/callback` | GET | Public | OAuth callback handler |
| `/api/analytics` | GET | User | Dashboard statistics (document/conversation counts) |
| `/api/documents/upload` | GET, POST | User | List and upload documents |
| `/api/documents/[id]` | GET, DELETE | User | Get or delete a document |
| `/api/documents/[id]/download` | GET | User | Stream original file from storage |
| `/api/documents/[id]/chat` | POST | User | Document-specific AI chat |
| `/api/ocr` | POST | User | Trigger OCR on a document |
| `/api/search` | GET | User | Semantic + text search |
| `/api/chat` | POST | User | AI chat with RAG |
| `/api/chat/conversations` | GET, POST | User | List and create conversations |
| `/api/chat/conversations/[id]` | GET, DELETE | User | Get or delete a conversation |
| `/api/backoffice/companies` | GET, POST | Super Admin | List and create companies |
| `/api/backoffice/companies/[id]` | GET, PUT, DELETE | Super Admin | Company CRUD |
| `/api/backoffice/companies/[id]/features` | GET, PUT | Super Admin | Feature toggles |
| `/api/backoffice/companies/[id]/license` | GET, PUT | Super Admin | License management |
| `/api/backoffice/companies/[id]/users` | GET, PUT | Super Admin | User role management |
| `/api/backoffice/analytics` | GET | Super Admin | Platform-wide analytics |

### 4.6 Frontend Route Map

| Path | Page | Access |
|------|------|--------|
| `/login` | Login page (email + Google) | Public |
| `/signup` | Registration page | Public |
| `/` | Dashboard homepage | Authenticated |
| `/documents` | Document management | Authenticated |
| `/search` | Intelligent search | Authenticated |
| `/chat` | AI Chat interface | Authenticated |
| `/backoffice` | Admin company management | SUPER_ADMIN |
| `/backoffice/companies/[id]` | Company detail (tabs: details, features, license, users) | SUPER_ADMIN |
| `/backoffice/analytics` | Platform analytics | SUPER_ADMIN |

### 4.7 Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| `UIFeedbackProvider` | `src/components/UIFeedback.tsx` | Context provider for in-app toast notifications and confirmation modals |
| `DocumentViewerModal` | `src/app/(dashboard)/documents/[id]/DocumentViewerModal.tsx` | Split-panel modal: PDF viewer + document-specific AI chat |
| `Providers` | `src/app/providers.tsx` | Client-side context wrapper for root layout |
| Dashboard Layout | `src/app/(dashboard)/layout.tsx` | Sidebar navigation + header for all dashboard pages |
| Backoffice Layout | `src/app/backoffice/layout.tsx` | Sidebar navigation for admin pages |

### 4.8 AI Models Used

| Model | Purpose | Used In |
|-------|---------|---------|
| `gpt-4o-mini` | Chat responses, search summaries | `/api/chat`, `/api/search`, `/api/documents/[id]/chat` |
| `gpt-4o` | Image OCR (Vision API) | `/api/ocr` |
| `text-embedding-3-small` | Document embedding generation, query embedding for search/chat | `lib/embeddings.ts`, `/api/chat`, `/api/search` |

---

## Appendix: OpenAI API Cost Considerations

| Operation | Model | Approximate Cost |
|-----------|-------|------------------|
| Chat message | `gpt-4o-mini` | ~$0.15 / 1M input tokens, ~$0.60 / 1M output tokens |
| Image OCR | `gpt-4o` | ~$2.50 / 1M input tokens |
| Embedding (query) | `text-embedding-3-small` | ~$0.02 / 1M tokens |
| Embedding (document) | `text-embedding-3-small` | ~$0.02 / 1M tokens |
