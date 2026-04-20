# 05 — Security

## Tenant Isolation

| Layer | Mechanism |
|-------|-----------|
| **Application** | All queries include `companyId` filter from authenticated user |
| **Database** | No RLS enforced (isolation at application layer) |
| **Storage** | Files keyed by `documents/{companyId}/{uuid}-{filename}` |
| **API** | `getCurrentUser()` extracts `companyId` from JWT → DB user |

> **Risk**: If application code omits `companyId` filter, cross-tenant data leak is possible. All API routes must include this filter.

## Authentication Security

| Measure | Status |
|---------|--------|
| JWT via HTTP-only cookies | ✅ Implemented (via `@supabase/ssr`) |
| Session refresh | ✅ Automatic (Supabase handles) |
| Password hashing | ✅ Managed by Supabase Auth (bcrypt) |
| Rate limiting on auth | ✅ Managed by Supabase |
| OAuth state parameter | ✅ Handled by Supabase OAuth flow |
| MFA | ❌ Not implemented |

## File Access Rules

- Files stored in Supabase Storage with service role access
- No per-file ACL — any authenticated user in the company can access company files
- Direct download URLs are generated server-side
- No signed URL expiration currently enforced

## Encryption

| Type | Status |
|------|--------|
| **In transit** | ✅ HTTPS enforced (Vercel/hosting) |
| **At rest (DB)** | ✅ Managed by Supabase (encrypted storage) |
| **At rest (Storage)** | ✅ Managed by Supabase |
| **Application-level encryption** | ❌ No additional encryption layer |

## Secrets Handling

| Secret | Storage | Exposure Risk |
|--------|---------|---------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` / Vercel dashboard | Server-only, never in client bundle |
| `OPENAI_API_KEY` | `.env.local` / Vercel dashboard | Server-only |
| `GOOGLE_CLIENT_SECRET` | `.env.local` / Vercel dashboard | Server-only |
| Database password | Inside `DATABASE_URL` | Server-only |

## Audit Logging

| Entity | Audit | Storage |
|--------|-------|---------|
| Task changes | ✅ `TaskActivity` table | action, metadata, actor, timestamp |
| CRM lead changes | ✅ `CrmLeadActivity` table | action, content, metadata, actor |
| Classification runs | ✅ `ClassificationHistory` table | action, feedback, metadata |
| User login | ⚠️ Supabase Auth logs only | Not stored in application DB |
| Data access | ❌ No query logging | — |
| Admin actions | ❌ No admin audit trail | — |

## Rate Limiting

| Layer | Status |
|-------|--------|
| Supabase Auth | ✅ Built-in rate limiting |
| API routes | ❌ No application-level rate limiting |
| OpenAI | ✅ Managed by OpenAI account limits |
| File uploads | ❌ No size limit or frequency limit enforced |

## Prompt Injection Mitigation

| Strategy | Status |
|----------|--------|
| System prompt separation | ✅ System prompt is separate from user input |
| RAG context isolation | ✅ Knowledge injected in tagged block (`=== COMPANY KNOWLEDGE BASE ===`) |
| Input sanitization | ❌ User input passed directly to LLM |
| Output filtering | ❌ No post-processing of AI output |
| Prompt template injection | ⚠️ Some assistant system prompts include user-provided company data |

> **Risk**: User-provided company profile data (description, products, etc.) is injected into system prompts without sanitization. This could be exploited for indirect prompt injection.

## Sensitive Data Handling

| Data Type | Handling |
|-----------|----------|
| User passwords | Never stored in application DB; managed by Supabase Auth |
| API keys | Server-side only, never logged |
| Company documents | Stored in Supabase Storage, access via service role |
| AI conversation history | Stored in DB; no encryption; company-scoped |
| Personal data (name, email) | Stored in plaintext; no data anonymization |

## Admin Access Controls

| Capability | Who Can |
|-----------|---------|
| View all companies | `SUPER_ADMIN` only |
| Create/delete companies | `SUPER_ADMIN` only |
| Toggle features | `SUPER_ADMIN` only |
| Manage users | `ADMIN` within company, or `SUPER_ADMIN` |
| Modify access groups | `ADMIN` within company |
| Access backoffice | `SUPER_ADMIN` only |

## Security Gaps (Known)

| Gap | Risk | Priority |
|-----|------|----------|
| No RLS enforcement | Cross-tenant access if code has bugs | High |
| No API rate limiting | DDoS or abuse risk | Medium |
| No MFA | Account takeover risk | Medium |
| No admin audit trail | Cannot trace admin actions | Medium |
| No input sanitization for prompts | Indirect prompt injection | Medium |
| No file type/size validation | Malicious file upload | Low |
| No signed URL expiration | Document URLs may be shareable | Low |
