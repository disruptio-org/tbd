# 03 — Environment Configuration

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Supabase) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key (public, for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only, bypasses RLS) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for GPT, embeddings, Whisper |
| `GOOGLE_CLIENT_ID` | ⚠️ | Google OAuth client ID (optional, for social login) |
| `GOOGLE_CLIENT_SECRET` | ⚠️ | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | ✅ | Base URL of the application |

## What Each Variable Does

### Database
- `DATABASE_URL`: Full PostgreSQL connection string used by Prisma. Points to Supabase PostgreSQL instance or self-hosted DB.

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: The HTTPS URL of your Supabase project. Used by both client and server.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Used by the browser client for authenticated requests. Has RLS-restricted access.
- `SUPABASE_SERVICE_ROLE_KEY`: **Server-only**. Bypasses Row-Level Security. Used for admin operations (user management, storage admin, auth admin). **Never expose to client.**

### AI
- `OPENAI_API_KEY`: Used for all OpenAI services — chat completion (GPT-4o/mini), embeddings (text-embedding-3-small), and speech transcription (Whisper). If not set, AI features degrade gracefully (empty RAG, generation errors).

### OAuth
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Enable Google social login. If not configured, only email/password login is available.

### App
- `NEXT_PUBLIC_APP_URL`: Base URL for the application. Used for OAuth callbacks, email links, and absolute URL generation.

## Example .env Structure

```env
# ─── Database ───────────────────────
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"

# ─── Supabase ───────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# ─── OpenAI ─────────────────────────
OPENAI_API_KEY="sk-..."

# ─── Google OAuth (optional) ────────
GOOGLE_CLIENT_ID="123456789.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."

# ─── App ────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Local vs Production Differences

| Setting | Local | Production |
|---------|-------|------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://app.nousio.com` |
| `DATABASE_URL` | Same Supabase cloud (no local DB) | Same Supabase cloud |
| SSL | No | Enforced via hosting provider |
| Debug logging | Enabled (console.log everywhere) | Same (no log-level control) |

## Feature Flags

Feature flags are controlled at the database level, not via env vars:
- `CompanyFeature` table: per-company feature toggles (managed via Backoffice)
- `AccessPermissionGrant` table: per-group permission grants

There is no environment-based feature flag system.

## Secret Handling

| Secret | Storage | Access |
|--------|---------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` (server-only) | Never exposed to `NEXT_PUBLIC_*` |
| `OPENAI_API_KEY` | `.env.local` (server-only) | Only used in API route handlers |
| `GOOGLE_CLIENT_SECRET` | `.env.local` (server-only) | Only used in OAuth callback |
| Database password | Inside `DATABASE_URL` | Server-only |

## Unsafe Defaults to Avoid

| ❌ Don't | ✅ Do |
|----------|-------|
| Commit `.env.local` to git | Use `.env.example` as template |
| Use `NEXT_PUBLIC_` prefix for secrets | Keep secrets server-only |
| Share `SUPABASE_SERVICE_ROLE_KEY` | Use anon key for client |
| Use production keys in development | Create separate Supabase project for dev |
| Leave `OPENAI_API_KEY` unrestricted | Set usage limits in OpenAI dashboard |
