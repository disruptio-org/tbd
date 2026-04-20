# 03 — Backend Architecture

## Folder Structure

```
src/
├── app/
│   └── api/                    # All API routes (Next.js App Router)
│       ├── ai/                 # General AI utilities
│       ├── ai-assistant/       # Action Assistant (voice/intent routing)
│       ├── analytics/          # Usage analytics
│       ├── assistant/          # Shared assistant logic
│       ├── auth/               # Auth callbacks (Google OAuth)
│       ├── backoffice/         # Super admin APIs (companies, features, users)
│       ├── chat/               # Conversations and messages
│       ├── classifications/    # Document classification/extraction
│       ├── company/            # Company profile, settings
│       ├── company-advisor/    # Advisor assistant
│       ├── crm/                # CRM leads, pipeline, contacts, activities
│       ├── dashboard/          # Dashboard stats
│       ├── documents/          # Upload, list, delete, OCR, embeddings
│       ├── general-ai/         # General AI generation
│       ├── knowledge-gaps/     # Knowledge gap detection
│       ├── leads/              # Lead discovery
│       ├── marketing/          # Marketing assistant
│       ├── ocr/                # OCR processing
│       ├── onboarding/         # Onboarding wizard state
│       ├── onboarding-assistant/ # Onboarding content assistant
│       ├── product/            # Product assistant
│       ├── projects/           # Project/workspace management
│       ├── sales/              # Sales assistant
│       ├── search/             # Semantic search
│       ├── speech/             # Voice transcription (Whisper)
│       ├── tasks/              # Task boards, tasks, comments, etc.
│       └── user/               # User profile, preferences, access
├── lib/                        # Shared backend utilities
│   ├── auth.ts                 # getCurrentUser(), requireSuperAdmin()
│   ├── user.ts                 # ensureDbUser() — sync Supabase ↔ DB
│   ├── permissions.ts          # Feature keys, access levels, permission catalog
│   ├── access-resolver.ts      # Resolve effective user permissions
│   ├── embeddings.ts           # chunkText(), generateEmbeddings(), embedDocument()
│   ├── rag-retrieval.ts        # retrieveRelevantKnowledge(), formatRAGContext()
│   ├── assistant-generate.ts   # Shared AI generation pipeline
│   ├── openai.ts               # OpenAI client singleton
│   ├── prisma.ts               # Prisma client singleton
│   ├── require-company-admin.ts # Admin role guard
│   ├── useWhisper.ts           # Voice transcription hook (client-side)
│   └── supabase/
│       ├── admin.ts            # Service role client (bypasses RLS)
│       ├── client.ts           # Browser client
│       └── server.ts           # Server-side client (with cookies)
```

## Application Layers

The backend is organized in a **flat route handler pattern** (no controllers/services separation):

| Layer | Location | Description |
|-------|----------|-------------|
| **Route Handlers** | `src/app/api/*/route.ts` | Each file exports `GET`, `POST`, `PUT`, `DELETE` |
| **Auth Guards** | `src/lib/auth.ts` | `getCurrentUser()` validates JWT and syncs DB user |
| **Business Logic** | Inline in route handlers | Most logic lives directly in the `GET`/`POST` functions |
| **Shared Utilities** | `src/lib/*.ts` | RAG, embeddings, permissions, AI generation |
| **Data Access** | Prisma + Supabase JS | Prisma for complex queries; Supabase for storage, auth admin |

## Authentication Flow

```
Request → Extract JWT from cookie (Supabase SSR)
  → Validate session (supabase.auth.getUser())
  → ensureDbUser() creates/syncs User record
  → Return { supabaseUser, dbUser }
```

Guards:
- `getCurrentUser()` — any authenticated user
- `requireSuperAdmin()` — validates `role === 'SUPER_ADMIN'`
- `requireCompanyAdmin()` — validates `role === 'ADMIN'` within the company

## Validation Strategy

- **Zod** for request body validation in key API routes
- Many routes use simple manual checks (`if (!field) return 400`)
- No centralized middleware validation layer

## Error Handling

- `try/catch` in every route handler
- Console logging with tagged prefixes (e.g., `[rag]`, `[embed]`, `[backoffice/users POST]`)
- JSON error responses with `{ error: string }` and appropriate HTTP status codes
- No global error boundary or error tracking service currently

## Data Access Patterns

### Prisma Client (via `src/lib/prisma.ts`)
Used for complex queries, relations, transactions:
```typescript
import prisma from '@/lib/prisma';
const docs = await prisma.document.findMany({ where: { companyId }, include: { embeddings: true } });
```

### Supabase Admin Client (via `src/lib/supabase/admin.ts`)
Used for auth admin, storage, and simple CRUD with service role (bypasses RLS):
```typescript
const db = createAdminClient();
const { data } = await db.from('User').select('*').eq('companyId', id);
```

### Supabase Server Client (via `src/lib/supabase/server.ts`)
Used for cookie-based auth validation in API routes:
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

## AI Generation Pipeline

Located in `src/lib/assistant-generate.ts`:

1. Load company profile and AI Brain config
2. Call `retrieveRelevantKnowledge()` for RAG context
3. Build system prompt with company context + brain instructions + RAG chunks
4. Call OpenAI Chat Completion
5. Return generated text
6. Caller route creates GenerationRun record

## Background Jobs

> **Currently none.** All processing (embedding generation, AI responses, file processing) runs synchronously within HTTP request handlers. A job queue is a future priority.
