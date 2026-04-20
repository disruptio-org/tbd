# 03 — Decision Log

Architecture Decision Records (ADRs) documenting major technical decisions.

---

## ADR-001: Next.js Monolithic Architecture

**Date**: Project inception
**Context**: Needed full-stack framework for AI SaaS product with both frontend and API.
**Decision**: Use Next.js App Router as a monolithic full-stack framework.
**Alternatives**:
- Separate React frontend + Express backend
- Separate React frontend + NestJS backend
- Remix
**Consequences**:
- ✅ Shared types between frontend and backend
- ✅ Simplified deployment (single build)
- ✅ Co-located API routes with pages
- ❌ No microservice boundaries
- ❌ Limited control over backend runtime

---

## ADR-002: Supabase as Backend-as-a-Service

**Date**: Project inception
**Context**: Need managed auth, database, and file storage with minimal ops overhead.
**Decision**: Use Supabase for PostgreSQL, Auth, and Storage.
**Alternatives**:
- Firebase (NoSQL, worse for relational data)
- Self-hosted PostgreSQL + custom auth
- Auth0 + AWS RDS + S3
**Consequences**:
- ✅ Managed infrastructure
- ✅ PostgreSQL with pgvector support
- ✅ Built-in auth with social providers
- ❌ Vendor lock-in
- ❌ Dual data access pattern (Prisma + Supabase JS)

---

## ADR-003: Prisma as ORM

**Date**: Project inception
**Context**: Need type-safe data access for complex relational schema.
**Decision**: Use Prisma 7 with PostgreSQL.
**Alternatives**:
- Drizzle ORM (lighter, SQL-first)
- TypeORM (heavier, decorator-based)
- Raw SQL via pg
**Consequences**:
- ✅ Type-safe queries
- ✅ Schema-first design with migrations
- ✅ Prisma Studio for data inspection
- ❌ No native pgvector support
- ❌ Learning curve for advanced patterns

---

## ADR-004: Vanilla CSS over Tailwind

**Date**: Design system establishment
**Context**: Building a distinctive "Tactile Brutalism" design system.
**Decision**: Use vanilla CSS with custom properties (design tokens).
**Alternatives**:
- Tailwind CSS (utility-first)
- CSS Modules
- styled-components
**Consequences**:
- ✅ Full control over design system implementation
- ✅ No build tool dependency
- ✅ Explicit, readable class names
- ❌ More verbose
- ❌ Requires strict naming conventions

---

## ADR-005: OpenAI as Single AI Provider

**Date**: AI feature development
**Context**: Need LLM, embeddings, and voice transcription.
**Decision**: Use OpenAI exclusively (GPT-4o/mini, text-embedding-3-small, Whisper).
**Alternatives**:
- Multi-provider (Anthropic + OpenAI + Google)
- Open-source models (Llama, Mistral)
- Azure OpenAI
**Consequences**:
- ✅ Consistent API, well-documented
- ✅ Simple integration (single SDK)
- ✅ Best-in-class model quality
- ❌ Single vendor dependency
- ❌ Cost scales linearly with usage
- ❌ No fallback if OpenAI is down

---

## ADR-006: pgvector for Embeddings Storage

**Date**: RAG implementation
**Context**: Need vector storage for document embeddings.
**Decision**: Use pgvector extension in Supabase PostgreSQL.
**Alternatives**:
- Pinecone (dedicated vector DB)
- Weaviate
- Qdrant
- Chroma
**Consequences**:
- ✅ No additional service to manage
- ✅ Embeddings co-located with documents
- ✅ Lower cost (included in Supabase)
- ❌ In-memory cosine similarity (not using pgvector native queries yet)
- ❌ May not scale for very large embedding stores

---

## ADR-007: Application-Level Tenant Isolation

**Date**: Multi-tenant implementation
**Context**: Need tenant isolation for multi-company platform.
**Decision**: Enforce isolation at application level via `companyId` filters in all queries.
**Alternatives**:
- Supabase RLS (database-level isolation)
- Separate databases per tenant
- Schema-per-tenant
**Consequences**:
- ✅ Simple to implement
- ✅ Full control over access patterns
- ❌ Security depends on every API route including the filter
- ❌ No database-level safety net

---

## ADR-008: No Background Job Queue

**Date**: Project inception
**Context**: Decided to keep architecture simple initially.
**Decision**: All processing (AI generation, embeddings) runs synchronously in HTTP handlers.
**Alternatives**:
- BullMQ + Redis
- Supabase Edge Functions with queue
- AWS SQS + Lambda
**Consequences**:
- ✅ Simple deployment, no Redis dependency
- ✅ Easy to debug (synchronous execution)
- ❌ HTTP requests block during AI processing
- ❌ Timeout risk for long operations
- ❌ Poor UX (no streaming, no progress indicators)

---

## ADR-009: RBAC via Access Groups

**Date**: Access control implementation
**Context**: Need fine-grained permission system beyond simple roles.
**Decision**: Group-based permissions with feature/sub-feature grants.
**Alternatives**:
- Simple role-based (ADMIN/MEMBER only)
- Attribute-based access control (ABAC)
- Policy-based (Casbin, OPA)
**Consequences**:
- ✅ Flexible, fine-grained control
- ✅ Multiple groups per user with union semantics
- ✅ Admin override simplifies management
- ❌ More complex than simple RBAC
- ❌ Permission resolution has performance cost

---

## ADR-010: Dynamic Sidebar Resources (1 Member = 1 Resource)

**Date**: April 2026
**Context**: The sidebar RESOURCES section was hardcoded with predefined assistant types (Marketing, Sales, Product, etc.). Users expected that deleting a team member would remove it from the sidebar, but hardcoded items persisted.
**Decision**: Make the RESOURCES sidebar fully dynamic — driven by actual `AIBrainProfile` records from `/api/ai/brains`. Remove all predefined brain types from the "Add Member" dropdown; all members are custom-created.
**Alternatives**:
- Keep hardcoded types + add dynamic custom types
- Feature-flag each assistant type individually
**Consequences**:
- ✅ 1 member = 1 resource — clean, intuitive model
- ✅ Deleting a brain immediately removes it from sidebar
- ✅ Users have full control over their AI team composition
- ❌ Sidebar briefly empty before `/api/ai/brains` response loads
- ❌ No "quick start" with pre-built assistant types

---

## ADR-011: Content-Based Document Versioning

**Date**: April 2026
**Context**: Users re-uploaded documents without knowing if they were duplicates or updates. No dedup or version tracking existed.
**Decision**: SHA-256 hash computed on upload. Same filename + same hash → 409 Conflict. Same filename + different hash → version increment with old embeddings cleared.
**Alternatives**:
- Filename-only dedup (fragile, ignores content changes)
- Full version history with file storage per version
- Content-addressable storage (CAS)
**Consequences**:
- ✅ Prevents exact duplicate uploads
- ✅ Automatically detects content updates
- ✅ Version counter provides audit trail
- ❌ Hash computation adds ~50ms to upload
- ❌ No rollback to previous versions (only version number tracked)
