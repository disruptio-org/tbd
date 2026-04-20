# 01 — System Architecture

## High-Level Architecture

Nousio follows a **monolithic Next.js full-stack architecture** with serverless API routes, client-side rendering for the dashboard, and managed cloud services for persistence and AI.

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│  React 19 · Next.js 16 App Router · Lucide Icons         │
│  Recharts · React Markdown · dnd-kit                     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS (fetch / SSR)
┌────────────────────▼────────────────────────────────────┐
│              NEXT.JS SERVER (API Routes)                  │
│  src/app/api/* — 30+ API modules                          │
│  Auth middleware · RAG retrieval · Embeddings pipeline    │
│  Business logic in route handlers                        │
└──┬──────────┬──────────┬──────────┬─────────────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Supa  │ │Supabase│ │Supabase│ │ OpenAI │
│Auth  │ │Postgres│ │Storage │ │  API   │
│(JWT) │ │(Prisma)│ │(Files) │ │(GPT/   │
│      │ │        │ │        │ │ Embed/ │
│      │ │pgvector│ │        │ │Whisper)│
└──────┘ └────────┘ └────────┘ └────────┘
```

## Frontend

- **Framework**: Next.js 16 (App Router)
- **Rendering**: Client-side rendering (`'use client'` pages) with server components for layouts
- **State**: React `useState`/`useEffect` (no external state management)
- **Styling**: Vanilla CSS with design tokens (`globals.css` — Tactile Brutalism system)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Drag & Drop**: dnd-kit (tasks kanban)
- **Markdown**: react-markdown (AI chat rendering)
- **Voice**: Browser Web Speech API + Whisper (via `useWhisper.ts`)

## Backend

- **Runtime**: Next.js API Routes (Node.js serverless functions)
- **ORM**: Prisma 7 (PostgreSQL)
- **Database**: Supabase PostgreSQL with pgvector extension
- **Data Access**: Dual layer — Prisma Client for complex queries, Supabase JS Client for simple CRUD and auth
- **Authentication**: Supabase Auth (JWT via `@supabase/ssr`)
- **File Storage**: Supabase Storage (buckets)
- **AI Provider**: OpenAI (GPT-4o, GPT-4o-mini, text-embedding-3-small, Whisper)
- **Validation**: Zod (request body validation)

## Request Flow

### Authenticated API Request
```
1. Browser → Next.js API Route
2. Route handler calls getCurrentUser()
3. getCurrentUser() → Supabase Auth (validate JWT from cookie)
4. If valid → ensureDbUser() → upsert User in DB
5. Route handler executes business logic
6. Prisma/Supabase queries for data access
7. (Optional) OpenAI API call for AI features
8. JSON response back to client
```

### RAG-Enhanced AI Request
```
1. User input received
2. retrieveRelevantKnowledge(companyId, query)
   a. Generate query embedding (OpenAI)
   b. Fetch all company DocumentEmbeddings
   c. Cosine similarity scoring
   d. Metadata enrichment (knowledge priority, recency)
   e. Diversity + dedup + cap (max 8 chunks)
3. Format RAG context string
4. Inject into system prompt
5. OpenAI Chat Completion call
6. Response returned
```

## Synchronous vs Asynchronous

| Operation | Type | Notes |
|-----------|------|-------|
| API requests | Synchronous | All API routes are request-response |
| AI generation | Synchronous | Waits for full OpenAI response (some routes support streaming) |
| Document embedding | Synchronous | Runs inline after document upload |
| File upload to Storage | Synchronous | Supabase Storage upload in request handler |
| Onboarding guide generation | Synchronous | Blocks until GPT completes |

> **Note**: There is no background job queue currently. All operations run within the HTTP request lifecycle.

## External Dependencies

| Service | Purpose | Criticality |
|---------|---------|-------------|
| Supabase Auth | Authentication, session management | Critical |
| Supabase PostgreSQL | Primary data store | Critical |
| Supabase Storage | File/document storage | Critical |
| OpenAI API | LLM generation, embeddings, whisper | Critical |
| Google OAuth | Optional social login | Optional |

## Environments

| Environment | URL | Notes |
|-------------|-----|-------|
| Local | `http://localhost:5000` | `npm run dev -p 5000`, connects to Supabase cloud |
| Production | Deployed via Vercel or VM | `npm run build && npm start` |
