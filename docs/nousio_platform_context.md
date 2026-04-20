# Nousio — Platform Context Document

> **Purpose**: This document provides comprehensive context about the Nousio AI platform — its architecture, features, tech stack, and internal systems. Upload this to any ChatGPT / LLM conversation to give the model full context about the project.

---

## 1. What is Nousio?

Nousio is a **multi-tenant B2B AI platform** that gives companies a full team of AI employees. Instead of one generic chatbot, each company gets a configurable **AI team** with specialized members (marketing, sales, product, leads, design, etc.) that operate with deep company knowledge.

The platform is built around three core pillars:
1. **Company DNA** — A knowledge graph that extracts, structures, and maintains everything the AI needs to know about a company.
2. **AI Team** — Individually configurable AI personas with distinct identities, tones, reasoning styles, and expertise areas.
3. **Boardroom** — An executive orchestration layer where a "Company DNA" brain decomposes strategic commands into multi-step initiatives executed by the AI team.

**Target users**: Small to mid-sized B2B companies (SaaS startups, agencies, e-commerce, consulting firms) that want AI-powered operations without building their own AI infrastructure.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict) |
| **UI** | React 19, Lucide Icons, Vanilla CSS ("Tactile Brutalism" design system) |
| **Database** | Supabase (PostgreSQL via PostgREST) |
| **ORM** | Supabase JS client (direct), Prisma (schema reference only) |
| **AI Models** | OpenAI GPT-5.4, GPT-5.4-mini (via Responses API with structured JSON output) |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536 dimensions) |
| **Document Processing** | pdf-parse, mammoth (DOCX), OCR pipeline |
| **Integrations** | Google Drive, Notion, Zapier MCP (Model Context Protocol) |
| **Auth** | Supabase Auth (cookie-based SSR sessions) |
| **Hosting** | Vercel (with Cron Jobs) |
| **Charts** | Recharts |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     NOUSIO PLATFORM                         │
├─────────────────────────────────────────────────────────────┤
│  PRESENTATION LAYER (Next.js App Router)                    │
│  ├── Dashboard (home, analytics, KPIs)                      │
│  ├── AI Assistants (marketing, sales, product, leads)       │
│  ├── Action Assistant (intent-based chat orchestrator)       │
│  ├── Boardroom (initiative planning & execution)             │
│  ├── Company DNA (knowledge graph explorer)                  │
│  ├── Documents (upload, OCR, embedding, folder management)   │
│  ├── Tasks (Kanban boards per project)                       │
│  ├── CRM (customers, contacts, deals)                        │
│  ├── Skills (custom AI workflows + scheduling)               │
│  ├── Settings (company profile, users, access groups, AI)    │
│  └── Virtual Office (AI team workspace visualization)        │
├─────────────────────────────────────────────────────────────┤
│  AI LAYER                                                    │
│  ├── AI Brains (configurable identity/reasoning/guardrails)  │
│  ├── Intent Classifier (GPT-powered request routing)         │
│  ├── Module Adapters (marketing, sales, product, leads,      │
│  │   knowledge, tasks, navigation, design)                   │
│  ├── RAG Retrieval (embeddings + wiki-first + DNA context)   │
│  ├── Wiki Compiler (LLM knowledge extraction pipeline)       │
│  ├── Boardroom Orchestrator (initiative decomposition)       │
│  ├── Skill Chain Executor (multi-step workflows)             │
│  └── MCP Client (Zapier integration for external actions)    │
├─────────────────────────────────────────────────────────────┤
│  DATA LAYER (Supabase / PostgreSQL)                          │
│  ├── Multi-tenant (companyId on every table)                 │
│  ├── KnowledgeNode + KnowledgeEdge (knowledge graph)         │
│  ├── DocumentEmbedding (vector chunks for RAG)               │
│  ├── AIBrainProfile + AIBrainVersion (AI configuration)      │
│  ├── BoardroomInitiative + Task + Artifact (execution)       │
│  └── CompanyIntegration + ExternalAction (3rd party)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Core Systems

### 4.1 Company DNA & Wiki System

**Company DNA** is the structured knowledge backbone. It extracts entities from uploaded documents and organizes them into a queryable knowledge graph.

**Entity Taxonomy (13 types):**

| Type | Description |
|------|-------------|
| `product` | Products, services, features, technical specifications |
| `persona` | Buyer personas, ICPs, customer segments |
| `messaging` | Brand voice, value propositions, taglines |
| `case_study` | Success stories, ROI data, testimonials |
| `market` | Market segments, industries, trends, TAM |
| `pricing` | Pricing tiers, packages, billing terms |
| `competitor` | Competitor analysis, positioning, differentiation |
| `process` | SOPs, workflows, operational procedures |
| `methodology` | Frameworks, playbooks, design systems |
| `metric` | KPIs, benchmarks, OKRs, financial targets |
| `content_strategy` | Content pillars, editorial calendar, campaigns |
| `integration` | Tech stack, tools, API connections |
| `policy` | Company policies, compliance, HR guidelines |

**Wiki Compilation Pipeline:**
```
Document Upload → OCR/Text Extract → Embeddings → Wiki Compile
                                                    ↓
                                         GPT-5.4-mini extracts entities
                                                    ↓
                                         upsertNode() (fuzzy dedup)
                                                    ↓
                                         upsertEdge() (relationships)
                                                    ↓
                                         Update wiki index + coverage
```

**Key files:**
- `src/lib/wiki/compiler.ts` — LLM extraction engine
- `src/lib/wiki/retriever.ts` — Wiki-first knowledge retrieval
- `src/lib/wiki/linter.ts` — Automated health checker (daily cron)
- `src/lib/dna-builder.ts` — Node upsert, fuzzy dedup, coverage scoring

**Storage:** All wiki data stored as `KnowledgeNode` rows in Supabase (no separate wiki tables).

### 4.2 AI Team System

Each company has a configurable **AI team**. The team is composed of `AIBrainProfile` records, each with a deeply customizable configuration:

**Brain Types:**
- `COMPANY` — The executive brain (Company DNA). Plans initiatives, coordinates team.
- `SALES` — Sales content, proposals, outreach, objection handling.
- `MARKETING` — Content generation, campaigns, social posts, newsletters.
- `PRODUCT_ASSISTANT` — PRDs, feature specs, release notes.
- `LEAD_DISCOVERY` — B2B lead search (Apollo/Google enrichment).
- `COMPANY_ADVISOR` — Strategic advisor grounded in company knowledge.
- `ONBOARDING` — Onboarding guide for new users.

**Brain Configuration Schema** (`src/lib/ai-brains/schema.ts`):
Each brain has 5 config domains (all with numeric sliders 0-10):

| Domain | Controls |
|--------|----------|
| **Identity** | Tone preset, formality, warmth, assertiveness, creativity, humor, brand strictness, communication style, personality traits |
| **Reasoning** | Depth, speed-vs-thoroughness, proactiveness, challenge level, analytical style, recommendation strength, ask-when-uncertain |
| **Knowledge** | Source strictness, citation strictness, confidence thresholds, grounding requirements, external search behavior |
| **Task Behavior** | Detail level, action orientation, persuasion, educational style, verbosity, summary style |
| **Guardrails** | Avoid inventing data, flag uncertainty, avoid legal/financial/HR advice, avoid pricing commitments, sensitive topics, escalation instructions |

**Pre-built Team Templates:**
- SaaS Startup (4 members)
- Digital Agency (5 members)
- E-commerce (4 members)
- Consulting Firm (4 members)

### 4.3 Boardroom (Executive Orchestration)

The Boardroom is the strategic command layer. Users issue natural language commands, and the Company DNA brain decomposes them into structured **initiatives**.

**Flow:**
```
User Command → Orchestrator (GPT) → Initiative Plan
                                      ├── Workstreams (2-6 phases)
                                      ├── Tasks (assigned to AI brains)
                                      ├── Dependencies (DAG)
                                      ├── Approval Gates
                                      └── Artifacts (generated outputs)
```

**Work Types:** `website`, `campaign`, `lead_discovery`, `feature`, `content`, `custom`

**Initiative Lifecycle:**
`DRAFT → PLANNING → AWAITING_APPROVAL → APPROVED → IN_PROGRESS → REVIEW_READY → COMPLETED`

**Task Lifecycle:**
`NOT_STARTED → READY → IN_PROGRESS → DELIVERED → DONE`
(with `WAITING_DEPENDENCY`, `WAITING_APPROVAL`, `NEEDS_REVISION` branches)

**Approval Gates:** `plan_approval`, `design_review`, `publish`, `deploy`, `outbound`, `budget`, `crm_import`, `destructive`, `client_facing`

**Artifact Types:** `prd`, `wireframe`, `content_draft`, `lead_list`, `campaign_plan`, `technical_plan`, `website_structure`, `implementation_plan`, `code`, `custom`

### 4.4 Action Assistant (Chat Orchestrator)

The main chat interface uses a **state machine orchestrator** (`src/lib/assistant/orchestrator.ts`):

```
User Message → Intent Classification (GPT-5.4-mini)
                    ↓
              Route to Module Adapter
                    ↓
         ┌──────────┼──────────┐
    Marketing   Sales   Product   Leads   Knowledge   Tasks   Design   Navigation
                    ↓
              Execute Action (GPT-5.4 + RAG + Wiki)
                    ↓
              Store Result + Return to User
```

**Intent Types:** `generate_content`, `create_task`, `search_leads`, `query_knowledge`, `navigate`, `summarize`, `use_skill`

**Module Adapters** (in `src/lib/assistant/adapters/`):
- `marketing.ts` — LinkedIn posts, blog drafts, newsletters, campaign plans
- `sales.ts` — Proposals, outreach emails, follow-ups
- `product.ts` — PRDs, feature specs, product briefs
- `leads.ts` — B2B lead search with enrichment
- `knowledge.ts` — RAG-grounded Q&A about company knowledge
- `tasks.ts` — Create Kanban tasks from chat
- `design.ts` — UI wireframe generation
- `navigation.ts` — Page navigation shortcuts

### 4.5 Skills & Chain Execution

**Skills** are reusable AI workflows that users can create, schedule, and chain:

- **Custom Skills**: Users define instruction prompts, input params, and output formats
- **Scheduling**: Cron-based execution (every N minutes, daily, weekly, weekdays)
- **Chains**: Multi-step workflows where output feeds into next step:
  ```
  Research → Draft Article → Copy Review → Publish
  ```
- **Community Skills**: Shared across companies (marketplace concept)

**Key files:**
- `src/lib/community-skills/chain-executor.ts` — Multi-step execution engine
- `src/app/api/skills/scheduler/route.ts` — Vercel Cron handler (every 10 minutes)

### 4.6 Document Pipeline

**Upload paths:**
1. **Direct upload** — PDF, DOCX, images → OCR → text extraction → embedding → wiki compile
2. **Google Drive** — OAuth integration → sync files → extract → embed → wiki compile
3. **Notion** — OAuth integration → sync pages → extract → embed → wiki compile

**Processing pipeline:**
```
Upload → Store in Supabase Storage
      → OCR (image/PDF text extraction)
      → Text chunking (sliding window)
      → OpenAI embedding (text-embedding-3-small)
      → Store in DocumentEmbedding table
      → Wiki compilation (entity extraction)
      → Coverage recalculation
```

### 4.7 RAG + Wiki-First Retrieval

The retrieval system uses a **wiki-first** approach:

```
Query → retrieveWikiAndRAGContext()
            ├── 1. Search wiki pages (compiled knowledge) → keyword relevance scoring
            ├── 2. If wiki coverage < 3 pages → supplement with RAG chunks
            └── 3. Return combined context + grounding level (VERIFIED / PARTIAL / NOT_FOUND)
```

**Grounding levels:**
- `VERIFIED` — Enough wiki + RAG context to ground the answer
- `PARTIAL` — Some context found, may need to supplement
- `NOT_FOUND` — No relevant context; AI may need to use general knowledge

---

## 5. Multi-Tenancy & Access Control

### Data Isolation
Every database table is scoped by `companyId`. The Supabase admin client uses service-role keys (bypasses RLS) — all row-level filtering is done in application code.

### User Roles
- `SUPER_ADMIN` — Full platform access
- `ADMIN` — Full company access
- `MEMBER` — Restricted (only dashboard + chat by default)

### Access Groups
Granular permission system:
- **Feature-level**: VIEW / USE / MANAGE per module (e.g., "Marketing: USE")
- **Sub-feature-level**: Granular controls (e.g., "documents.upload", "tasks.create")
- **Project scoping**: Users can be restricted to specific projects

**Feature groups:**
| Group | Features |
|-------|----------|
| Core | Dashboard, Ask AI, Company Advisor, Search, Action Assistant |
| Knowledge | Documents, Data Extraction, Knowledge Insights |
| Growth | Marketing, Sales, Product, Leads, CRM, Onboarding |
| Execution | Tasks, Projects & Workspaces |
| Admin | Settings, AI Team, User Management, Access Groups, Integrations |

---

## 6. External Integrations

| Integration | Protocol | Purpose |
|-------------|----------|---------|
| **Google Drive** | OAuth 2.0 | Sync company documents for knowledge ingestion |
| **Notion** | OAuth 2.0 | Sync workspace pages for knowledge ingestion |
| **Zapier** | MCP (Model Context Protocol) | Execute external actions (send emails, update CRM, post to Slack, etc.) |

**Zapier MCP flow:**
```
User configures Zapier MCP endpoint → Nousio discovers available tools
                                    → AI can trigger actions post-generation
                                    → e.g., "Post this to LinkedIn via Zapier"
```

---

## 7. Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `Company` | Top-level tenant |
| `AppUser` | User accounts (linked to Supabase Auth) |
| `CompanyProfile` | Company metadata (name, description, brand voice, etc.) |
| `CompanyDNA` | DNA record per company (coverage score, version) |
| `KnowledgeNode` | Knowledge graph nodes (entities, wiki pages, index, logs) |
| `KnowledgeEdge` | Relationships between knowledge nodes |
| `Document` | Uploaded document metadata |
| `ExternalDocument` | Documents synced from integrations |
| `DocumentEmbedding` | Vector chunks for RAG retrieval |
| `AIBrainProfile` | AI team member configuration |
| `AIBrainVersion` | Versioned brain configs (rollback support) |
| `AssistantSkill` | Custom skill definitions |
| `SkillSchedule` | Cron schedules for skills |
| `SkillRun` | Execution history for skills |
| `BoardroomInitiative` | Strategic initiatives |
| `BoardroomWorkstream` | Workstreams within initiatives |
| `BoardroomTask` | Tasks assigned to AI team members |
| `BoardroomArtifact` | Generated artifacts (PRDs, wireframes, etc.) |
| `BoardroomArtifactVersion` | Versioned artifact content |
| `BoardroomApprovalRequest` | Human approval gates |
| `TaskBoard` | Kanban boards (per project) |
| `TaskItem` | Individual task cards |
| `Project` | Projects/workspaces |
| `Customer` | CRM customers |
| `CompanyIntegration` | Connected integrations (Google, Notion, Zapier) |
| `ExternalAction` | Zapier action catalog |
| `AccessGroup` | Permission groups |
| `AccessGroupRule` | Feature-level permission rules |

---

## 8. API Route Structure

All API routes live in `src/app/api/`:

```
/api/
├── ai/                    # AI brain management, chat, training
├── ai-assistant/          # Action assistant orchestrator
├── analytics/             # Dashboard analytics
├── artifacts/             # Boardroom artifact CRUD + generation
├── assistant/             # Legacy assistant endpoints
├── auth/                  # Authentication
├── boardroom/             # Initiatives, tasks, workstreams, commands
├── chat/                  # Ask AI chat sessions
├── classifications/       # Data extraction
├── company/               # Company profile
├── company-advisor/       # Strategic advisor
├── crm/                   # Customer management
├── customers/             # Customer CRUD
├── dna/                   # Company DNA endpoints
├── documents/             # Document upload, management
├── integrations/          # Google Drive, Notion, Zapier
├── knowledge-gaps/        # Gap analysis
├── leads/                 # Lead discovery
├── marketing/             # Marketing content generation
├── ocr/                   # OCR processing
├── onboarding/            # Onboarding flow
├── product/               # Product assistant
├── projects/              # Project management
├── sales/                 # Sales content generation
├── search/                # Semantic search
├── skills/                # Skills + scheduler (Vercel Cron)
├── tasks/                 # Task board management
├── virtual-office/        # AI team workspace
└── wiki/                  # Wiki backfill + lint endpoints
```

---

## 9. Design System

**"Tactile Brutalism"** — A custom design language characterized by:
- Bold geometric shapes with deliberate offset shadows
- Monospace headers (JetBrains Mono) + clean body text (Inter)
- High contrast borders with subtle depth layers
- Muted, harmonious color palette (no garish primaries)
- Smooth micro-animations on hover/focus states
- Dark sidebar + light content area layout

**Color palette:** Dark sidebar (`#0f172a`), warm accents, type-specific color coding for knowledge nodes.

---

## 10. Key Architectural Patterns

1. **Admin Client Pattern**: All backend DB access uses `createAdminClient()` (service-role key). No RLS — filtering by `companyId` in application code.

2. **Structured JSON Output**: All LLM calls use OpenAI's `json_schema` response format with strict schemas. This ensures reliable parsing.

3. **Responses API**: The codebase uses OpenAI's newer Responses API (`openai.responses.create()`) rather than the legacy Chat Completions API for most calls.

4. **Non-Blocking Enrichment**: Wiki compilation, embedding, and external syncs are wrapped in try/catch blocks — they never fail the primary operation (upload, OCR, etc.).

5. **Streaming SSE**: Long operations (DNA processing, backfill) use streaming NDJSON responses for real-time UI progress.

6. **Fuzzy Deduplication**: `upsertNode()` in `dna-builder.ts` uses fuzzy title matching to prevent duplicate knowledge nodes.

7. **Tiered Retrieval**: DNA context uses 3 tiers: Project-specific → Customer-level → Company-wide.

---

## 11. Vercel Cron Jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/skills/scheduler` | Every 10 minutes | Execute due scheduled skills |
| `/api/wiki/lint` | Daily at 06:00 UTC | Wiki health check across all companies |

---

## 12. Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API for all LLM calls |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `CRON_SECRET` | Optional secret for authenticating Vercel Cron calls |

---

## 13. Current Status

The platform is in active development. All core systems are functional:
- ✅ AI Team with configurable brains
- ✅ Company DNA knowledge graph (13-type taxonomy)
- ✅ LLM-Wiki compilation pipeline
- ✅ Wiki-first RAG retrieval
- ✅ Boardroom initiative orchestration
- ✅ Action Assistant with intent classification
- ✅ Skills with scheduling and chain execution
- ✅ Document pipeline (upload, OCR, embed, compile)
- ✅ Google Drive + Notion + Zapier MCP integrations
- ✅ Multi-tenant RBAC with access groups
- ✅ Automated wiki lint (daily cron)
- ✅ CRM module
- ✅ Task management (Kanban)
- ✅ Virtual Office (AI team workspace)
