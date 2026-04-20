# Disruptio — Business Requirements Document (BRD)
## Current Implementation Status

**Product**: AI Starter Kit SaaS for SMEs  
**Stack**: Next.js 16 · React 19 · Supabase (Auth + PostgreSQL + Storage) · Prisma ORM · OpenAI API  
**Language**: Portuguese (pt-PT) UI  
**Last Updated**: 2026-03-05

---

## 1. Architecture Overview

### 1.1 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19 | SSR/CSR, routing, UI |
| Styling | Vanilla CSS (design tokens) | Custom design system matching Disruptio brand |
| Auth | Supabase Auth (@supabase/ssr) | Email/password + Google OAuth |
| Database | PostgreSQL via Supabase | Data persistence (13 models) |
| ORM | Prisma 7 | Schema definition, migrations |
| Storage | Supabase Storage | Document file storage (`documents` bucket) |
| AI/ML | OpenAI API (GPT-4o, GPT-4o Vision) | Image OCR, diagnostics reports |
| OCR | pdf-parse (PDF), mammoth (DOCX), OpenAI Vision (images) | Text extraction pipeline |
| Charts | Recharts (installed, not yet used) | Data visualization |
| DnD | @dnd-kit (installed, not yet used) | Drag-and-drop workflow builder |
| Validation | Zod (installed, not yet used) | Schema validation |

### 1.2 Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Authenticated pages (9 modules)
│   │   ├── layout.tsx        # Sidebar navigation + header
│   │   ├── page.tsx          # Dashboard home
│   │   ├── analytics/        # Usage metrics dashboard
│   │   ├── automation/       # Workflow builder
│   │   ├── data-quality/     # Data validation tool
│   │   ├── diagnostics/      # Digital maturity assessment
│   │   ├── documents/        # Document management
│   │   ├── governance/       # Compliance templates
│   │   ├── search/           # Intelligent document search
│   │   ├── support/          # Support chat + FAQ
│   │   └── use-cases/        # AI use case library
│   ├── api/                  # 9 API routes
│   │   ├── analytics/        # GET: usage metrics + module breakdown
│   │   ├── auth/callback/    # GET: OAuth callback handler
│   │   ├── diagnostics/      # POST: submit assessment, GET: list
│   │   ├── documents/        # Upload (POST/GET) + Delete ([id] DELETE)
│   │   ├── governance/       # GET: list templates, PUT: customize
│   │   ├── ocr/              # POST: text extraction pipeline
│   │   ├── search/           # GET: document search (stub)
│   │   └── use-cases/        # GET: list use cases
│   ├── login/                # Login page
│   └── signup/               # Signup page
├── lib/
│   ├── auth.ts               # getCurrentUser() helper
│   ├── openai.ts             # OpenAI client singleton
│   ├── prisma.ts             # Prisma client singleton
│   ├── user.ts               # ensureDbUser() provisioning
│   └── supabase/             # 3 Supabase clients
│       ├── admin.ts          # Service role (bypasses RLS)
│       ├── client.ts         # Browser client
│       └── server.ts         # Server-side (cookie-based)
└── middleware.ts             # Auth guard (redirect to /login)
```

### 1.3 Data Model (Prisma Schema — 13 Models)

| Model | Purpose | Key Fields |
|---|---|---|
| **Company** | Multi-tenant organization | `name`, `plan` (default: "starter") |
| **User** | Authenticated user | `email`, `role` (MEMBER/ADMIN), `authProvider` (EMAIL/GOOGLE) |
| **Document** | Uploaded file record | `filename`, `mimeType`, `size`, `storageKey`, `extractedText`, `ocrProcessed` |
| **DocFolder** | Hierarchical folder tree | `parentId` (self-referential), `name` |
| **DocumentEmbedding** | Vector chunks for search | `chunkText`, `embedding` (JSON text), `chunkIndex` |
| **DiagnosticAssessment** | Maturity assessment result | `answers` (JSON), `score`, `report`, `status` (IN_PROGRESS/COMPLETED) |
| **UseCase** | AI use case library entry | `industry`, `title`, `summary`, `challenge`, `solution`, `results`, `isGlobal` |
| **DataQualityJob** | Data validation job | `sourceType`, `metrics` (JSON), `status`, `report` |
| **GovernanceTemplate** | Compliance template | `category`, `content`, `isGlobal`, `isCustom` |
| **Workflow** | Automation workflow | `trigger`, `steps` (JSON), `status` (DRAFT/ACTIVE/PAUSED/ARCHIVED) |
| **WorkflowRun** | Workflow execution log | `status`, `logs` (JSON), `startedAt`, `endedAt` |
| **UsageMetric** | Analytics event tracking | `event`, `module`, `metadata` (JSON) |
| **SupportTicket** | Support request | `channel` (CHAT/EMAIL/PHONE/SELF_SERVICE), `subject`, `body`, `status` |
| **Conversation** | Chat thread | `title`, linked to `Message[]` |
| **Message** | Chat message | `role` (USER/ASSISTANT/SYSTEM), `content` |

---

## 2. Feature-by-Feature Implementation Status

### 2.1 Authentication (FR-1) — ✅ Fully Implemented

| Aspect | Implementation |
|---|---|
| **Email/password** | Supabase `signInWithPassword()` on `/login` |
| **Google OAuth** | Supabase `signInWithOAuth({ provider: 'google' })` with callback at `/api/auth/callback` |
| **Signup** | Dedicated `/signup` page |
| **Session management** | Cookie-based via `@supabase/ssr`; middleware checks `getUser()` on every request |
| **Route protection** | `middleware.ts` redirects unauthenticated users to `/login`; public paths: `/login`, `/signup` |
| **User provisioning** | `ensureDbUser()` auto-creates `Company` + `User` records on first login via Supabase Data API (service role key) |
| **Logout** | `supabase.auth.signOut()` button in sidebar footer |

**Files**: `middleware.ts`, `login/page.tsx`, `signup/page.tsx`, `lib/auth.ts`, `lib/user.ts`, `api/auth/callback/route.ts`

---

### 2.2 Document Management (FR-2, FR-3) — ✅ Fully Implemented

| Aspect | Implementation |
|---|---|
| **Upload** | `POST /api/documents/upload` — accepts `FormData`, stores file to Supabase Storage (`documents` bucket), creates `Document` DB record |
| **Batch upload** | Frontend supports multi-file selection and drag-and-drop; files processed sequentially |
| **List documents** | `GET /api/documents/upload` — returns company documents ordered by `createdAt` desc |
| **Delete** | `DELETE /api/documents/[id]` — verifies company ownership, deletes embeddings then document |
| **Supported types** | PDF, DOCX, DOC, PNG, JPG, JPEG, TIFF, BMP (up to 50MB) |
| **Storage bucket** | Auto-created if missing; files stored at `documents/{companyId}/{uuid}-{filename}` |
| **UI** | Drag-and-drop zone, document table with filename/type/size/OCR status/date/actions |

**Files**: `documents/page.tsx`, `api/documents/upload/route.ts`, `api/documents/[id]/route.ts`

---

### 2.3 OCR — Text Extraction (FR-4, FR-5) — ✅ Fully Implemented

| Aspect | Implementation |
|---|---|
| **API** | `POST /api/ocr` with `{ documentId }` |
| **PDF extraction** | `pdf-parse` v2 (`PDFParse` class) |
| **DOCX extraction** | `mammoth.extractRawText()` |
| **Image OCR** | OpenAI GPT-4o Vision — base64 image sent as `image_url` content part |
| **Fallback** | Unknown MIME types processed as plain text |
| **Persistence** | Updates `Document.extractedText` and sets `ocrProcessed = true` |
| **UI trigger** | "Executar OCR" button per document in table; badge changes to "✓ Processado" |
| **Multi-language** | Supported via GPT-4o Vision (prompt-agnostic); `Document.language` field exists but not yet populated |

**Files**: `api/ocr/route.ts`, `documents/page.tsx`

---

### 2.4 Intelligent Search (FR-6, FR-7) — ⚠️ Stub (UI Complete, Backend Placeholder)

| Aspect | Implementation |
|---|---|
| **UI** | Search bar with NLP placeholder text, filter panel (type, date range), results list with filename/snippet/relevance score |
| **API** | `GET /api/search?q=...&type=...&from=...&to=...` — **always returns empty results** |
| **Planned architecture** | Comments in code show: embed query via `text-embedding-3-small` → cosine similarity against `DocumentEmbedding` table using pgvector |
| **Schema ready** | `DocumentEmbedding` model exists with `embedding` (text/JSON), `chunkText`, `chunkIndex` |
| **Missing** | Embedding generation on document upload, vector similarity query, pgvector extension setup |

**Files**: `search/page.tsx`, `api/search/route.ts`

---

### 2.5 Diagnostic Assessment (FR-8, FR-9) — ✅ Fully Implemented

| Aspect | Implementation |
|---|---|
| **Assessment flow** | 5-question wizard (step-by-step) covering: Digital Strategy, Data Management, Automation, Competencies, AI Adoption |
| **Scoring** | Each question 1–5 scale; total calculated as percentage |
| **Maturity levels** | Inicial (≤20%), Em Desenvolvimento (≤40%), Definido (≤60%), Gerido (≤80%), Otimizado (>80%) |
| **Report generation** | Tier-based static report text (3 tiers: ≤40%, ≤70%, >70%) with Portuguese recommendations |
| **Persistence** | `DiagnosticAssessment` record saved with answers (JSON), score, report, status=COMPLETED |
| **Usage tracking** | `UsageMetric` event recorded: `diagnostic_completed` |
| **Results UI** | Score card (percentage), maturity level badge, category breakdown with progress bars, AI recommendations section |
| **History** | `GET /api/diagnostics` returns past assessments (API exists, UI not yet connected) |

**Files**: `diagnostics/page.tsx`, `api/diagnostics/route.ts`

---

### 2.6 Use Case Library (FR-10, FR-11) — ✅ Fully Implemented

| Aspect | Implementation |
|---|---|
| **Data source** | `UseCase` table, populated via database seed script |
| **API** | `GET /api/use-cases` — returns all use cases ordered by `createdAt` desc |
| **Industry filter** | Dynamic dropdown populated from unique `industry` values in data |
| **Detail view** | Click-through to detail page showing Challenge / Solution / Results in 3-column grid |
| **Global vs. Company** | Schema supports `isGlobal` flag + optional `companyId` |

**Files**: `use-cases/page.tsx`, `api/use-cases/route.ts`, `prisma/seed.ts`

---

### 2.7 Data Quality Management (FR-12, FR-13) — ⚠️ Simulated (UI Complete, No Backend)

| Aspect | Implementation |
|---|---|
| **UI** | File upload (CSV/XLSX), metric cards (Completeness, Consistency, Accuracy, Uniqueness), issues list |
| **Analysis** | **Simulated** with hardcoded results after 2-second delay; no API call |
| **Metrics shown** | Completeness (87%), Consistency (92%), Accuracy (78%), Uniqueness (95%) — all mock values |
| **Issues shown** | 4 hardcoded issues (blank emails, duplicates, date formats, values out of range) |
| **"Clean Data" button** | Present in UI but **non-functional** |
| **Schema ready** | `DataQualityJob` model exists with `metrics` (JSON), `report`, `status` |
| **Missing** | `/api/data-quality` route, actual CSV/XLSX parsing, metric calculation engine |

**Files**: `data-quality/page.tsx`

---

### 2.8 Governance & Compliance Templates (FR-14, FR-15) — ✅ Fully Implemented

| Aspect | Implementation |
|---|---|
| **Data source** | `GovernanceTemplate` table, populated via seed script |
| **API (list)** | `GET /api/governance` — returns all templates |
| **API (customize)** | `PUT /api/governance` — if template is global, creates a company-specific copy; otherwise updates in-place |
| **Category filter** | Dynamic dropdown populated from unique `category` values |
| **Template editor** | Full-text textarea editor with Save functionality |
| **"Export PDF" button** | Present in UI but **non-functional** |
| **Usage tracking** | `UsageMetric` event recorded: `template_customized` |

**Files**: `governance/page.tsx`, `api/governance/route.ts`

---

### 2.9 Automation / Workflow Builder (FR-16) — ⚠️ Frontend Only (No Backend)

| Aspect | Implementation |
|---|---|
| **UI** | Template gallery (3 pre-built workflows), workflow detail view with step visualization |
| **Templates** | Document Processing (Upload→OCR→Classify→Archive), Data Validation, Weekly Report |
| **Step types** | Trigger (⚡), Action (▶️), Condition (🔀), AI (🤖) — color-coded |
| **Visual builder** | Vertical step list with arrows; "Add step" button |
| **Buttons** | "Test", "Activate", "+ New Workflow" — all **non-functional** |
| **Schema ready** | `Workflow` and `WorkflowRun` models exist |
| **dnd-kit installed** | Package installed but not yet integrated for drag-and-drop reordering |
| **Missing** | API routes, workflow execution engine, CRUD operations |

**Files**: `automation/page.tsx`

---

### 2.10 Analytics Dashboard (FR-17, FR-18) — ✅ Fully Implemented

| Aspect | Implementation |
|---|---|
| **API** | `GET /api/analytics` — returns overview counts, module usage breakdown, recent activity |
| **Overview stats** | Real counts from DB: Documents, Searches, Diagnostics, Automations |
| **Module usage** | Calculated from `UsageMetric` table — percentage per module |
| **Recent activity** | Last 10 `UsageMetric` records with Portuguese event labels and relative timestamps |
| **"Export Report" button** | Present in UI but **non-functional** |
| **Home dashboard** | Dashboard home page also fetches analytics for stat cards |

**Files**: `analytics/page.tsx`, `api/analytics/route.ts`, `(dashboard)/page.tsx`

---

### 2.11 Support (FR-19) — ⚠️ Simulated (UI Complete, No Backend)

| Aspect | Implementation |
|---|---|
| **Chat UI** | Message-based chat interface with user/assistant bubbles |
| **Chat response** | **Simulated** — 1.5-second delay, returns static response text |
| **FAQ section** | 5 expandable FAQ items (hardcoded) covering key platform features |
| **Contact info** | Email (suporte@disruptio.pt), phone (+351 21 000 0000), hours (Mon-Fri 9h-18h) |
| **Schema ready** | `SupportTicket`, `Conversation`, `Message` models exist |
| **Missing** | `/api/support` routes, real chat integration, ticket creation, conversation persistence |

**Files**: `support/page.tsx`

---

## 3. Cross-Cutting Concerns

### 3.1 Multi-Tenancy
- Company-scoped data isolation via `companyId` on all core tables
- User auto-provisioned with new Company on first login
- API routes filter by `auth.dbUser.companyId`
- Plan field exists (default: `starter`) but **plan enforcement not implemented**

### 3.2 Design System
- Custom CSS design system based on `Disruptio_Design_Principles.md`
- Design tokens: Inter font, 8pt grid, single red accent (#D73A3A), warm off-white background
- Component classes: `.card`, `.btn`, `.badge`, `.spinner`, `.input`, `.select`, `.textarea`
- Responsive: sidebar toggle for mobile, grid breakpoints

### 3.3 Navigation
- Sidebar with 3 sections: Principal (Dashboard, Documents, Search), Ferramentas (Diagnostics, Use Cases, Data Quality, Governance, Automation), Insights (Analytics, Support)
- Header with context-aware page title and "Marcar Diagnóstico" CTA
- Mobile hamburger menu with overlay

### 3.4 Usage Tracking
- `UsageMetric` events automatically recorded for: diagnostic completion, template customization
- Analytics API aggregates these for dashboard display
- **Not yet tracked**: document uploads, searches, workflow executions

---

## 4. Implementation Maturity Summary

| Feature | UI | API | Database | AI/ML | Status |
|---|:---:|:---:|:---:|:---:|---|
| Authentication | ✅ | ✅ | ✅ | — | **Production-ready** |
| Document Management | ✅ | ✅ | ✅ | — | **Production-ready** |
| OCR Extraction | ✅ | ✅ | ✅ | ✅ | **Production-ready** |
| Intelligent Search | ✅ | ⚠️ | ⚠️ | ❌ | **Stub** — needs embeddings + pgvector |
| Diagnostics | ✅ | ✅ | ✅ | ⚠️ | **Functional** — static reports (AI generation possible) |
| Use Case Library | ✅ | ✅ | ✅ | — | **Production-ready** (seed data) |
| Data Quality | ✅ | ❌ | ⚠️ | ❌ | **Mock only** — needs full backend |
| Governance Templates | ✅ | ✅ | ✅ | — | **Production-ready** (seed data) |
| Automation | ✅ | ❌ | ⚠️ | ❌ | **Frontend only** — needs execution engine |
| Analytics | ✅ | ✅ | ✅ | — | **Production-ready** |
| Support | ✅ | ❌ | ⚠️ | ❌ | **Mock only** — needs chat backend |

**Legend**: ✅ Implemented | ⚠️ Schema exists / partial | ❌ Not implemented

---

## 5. Environment Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, bypasses RLS) |
| `OPENAI_API_KEY` | OpenAI API key for OCR Vision + future AI features |
| `DATABASE_URL` | PostgreSQL connection string (Prisma) |

---

## 6. Key Gaps & Next Steps

1. **Intelligent Search**: Implement embedding generation pipeline on document upload/OCR, enable pgvector extension, build cosine similarity search endpoint
2. **Data Quality**: Build `/api/data-quality` route with CSV/XLSX parsing (e.g., `xlsx` library) and actual metric computation
3. **Automation Engine**: Build workflow CRUD API routes, implement step execution engine, integrate dnd-kit for visual builder
4. **Support Chat**: Connect to real AI assistant (OpenAI), persist conversations to `Conversation`/`Message` tables, implement ticket creation
5. **PDF Export**: Implement PDF generation for governance templates and analytics reports
6. **AI-Powered Diagnostics**: Replace static tier-based reports with OpenAI-generated personalized recommendations
7. **Usage Tracking**: Add tracking events for document uploads, searches, and workflow runs
8. **Plan Enforcement**: Implement feature gating based on `Company.plan` (starter vs. higher tiers)
9. **Document Folders**: `DocFolder` model exists but folder UI not yet built
10. **Recharts Integration**: Package installed but charts not yet rendered in analytics