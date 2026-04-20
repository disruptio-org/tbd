# 02 — Known Issues & Technical Debt

## Critical Issues

### No Background Job Processing
- **Impact**: All AI generation, embedding, and file processing blocks HTTP requests
- **Risk**: Timeouts on large documents, poor UX on slow AI responses
- **Resolution**: Implement BullMQ + Redis job queue
- **Priority**: 🔴 High

### In-Memory Vector Search
- **Impact**: RAG retrieval fetches ALL company embeddings into memory, computes cosine similarity in JS
- **Risk**: Memory exhaustion for companies with many documents, O(n) scaling
- **Resolution**: Use pgvector native similarity operators (`<=>`, `<#>`)
- **Priority**: 🔴 High

### No RLS Enforcement
- **Impact**: Tenant isolation relies entirely on application code (`companyId` filters)
- **Risk**: If any API route omits the filter, cross-tenant data leak is possible
- **Resolution**: Enable Supabase Row-Level Security policies for critical tables
- **Priority**: 🔴 High

## Architecture Debt

### Dual Data Access Layer
- **Issue**: Both Prisma Client and Supabase JS Client used for DB access
- **Why**: Prisma for ORM features, Supabase for auth admin and storage
- **Problem**: Inconsistent patterns, confusing for new developers
- **Resolution**: Standardize on Prisma for all DB queries; use Supabase client only for auth/storage
- **Priority**: 🟡 Medium

### Flat Route Handlers (No Service Layer)
- **Issue**: Business logic inline in API route handlers
- **Problem**: Code duplication, hard to test, no separation of concerns
- **Resolution**: Extract service layer for complex business logic
- **Priority**: 🟡 Medium

### No Shared Component Library
- **Issue**: UI components are inline within page files; no reusable component directory
- **Problem**: Duplicated UI patterns, inconsistent implementations
- **Resolution**: Create `src/components/` with shared Button, Card, Table, Modal, etc.
- **Priority**: 🟡 Medium

### No State Management
- **Issue**: All state is local (`useState`), fetched via `useEffect` on mount
- **Problem**: No caching, no deduplication, no optimistic updates
- **Resolution**: Introduce React Query (TanStack Query) for server state
- **Priority**: 🟡 Medium

## Known Weak Spots

| Area | Issue | Impact |
|------|-------|--------|
| Error handling | No global error boundary (server or client) | Unhandled errors crash silently |
| Logging | Console-only, no structured format, no log levels | Hard to debug in production |
| Testing | No unit or integration tests | No regression safety |
| Validation | Mix of Zod and manual checks, inconsistent | Invalid data may slip through |
| Auth | `ensureDbUser()` creates user record on every request | Potential race conditions |

## Performance Issues

| Issue | Location | Impact |
|-------|----------|--------|
| RAG retrieval loads all embeddings | `rag-retrieval.ts` | Memory spike on large knowledge bases |
| No database query optimization | Various API routes | Repeated queries for same data |
| No HTTP caching headers | All routes | Browser refetches everything |
| CSS file sizes | `globals.css` (14KB), `dashboard.css` (25KB) | Large initial CSS bundles |

## Legacy Code Areas

| Area | Issue |
|------|-------|
| `schema.prisma` Workflow models | Schema exists but workflows not implemented |
| Data Quality Jobs | Schema exists, minimal implementation |
| Governance Templates | Schema exists, not actively used |
| Use Cases | Schema exists, basic CRUD only |

## Short-Term Hacks

| Hack | Location | Why |
|------|----------|-----|
| Embeddings stored as JSON text | `DocumentEmbedding.embedding` | Prisma doesn't natively support pgvector |
| Full table scan for RAG | `rag-retrieval.ts` | No pgvector index query available via Supabase client |
| `ensureDbUser` on every API call | `auth.ts` | Auto-provisions user, but runs on every request |

## Refactor Priorities

1. **pgvector native queries** for RAG retrieval
2. **Background job queue** for AI processing
3. **Service layer extraction** from route handlers
4. **Shared component library** for UI consistency
5. **Structured logging** with log levels
6. **React Query** for server state management
7. **RLS policies** for critical tables
