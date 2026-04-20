# 06 — Observability & Monitoring

## Current State

Nousio has **minimal observability infrastructure**. Monitoring relies primarily on console logging and Supabase's built-in dashboards.

## Logs

| Log Type | Method | Examples |
|----------|--------|---------|
| Application | `console.log()` / `console.error()` | `[rag] Retrieved 5 chunks...`, `[embed] Generating embeddings...` |
| Tagged prefixes | Domain-specific tags | `[auth]`, `[rag]`, `[embed]`, `[backoffice/users POST]` |
| Auth errors | `console.error('[auth]')` | Session validation failures |
| API errors | `console.error()` in catch blocks | Database errors, OpenAI failures |

### Log Locations
- **Local dev**: Terminal output (stdout)
- **Vercel**: Vercel Logs (accessible via dashboard or CLI)
- **Self-hosted**: stdout/stderr (PM2 or journalctl)

### Missing
- ❌ No structured logging (JSON format)
- ❌ No log levels (debug/info/warn/error)
- ❌ No log aggregation service (e.g., DataDog, LogRocket)
- ❌ No request ID correlation

## Metrics

| Metric | Source | Status |
|--------|--------|--------|
| API response times | None | ❌ Not tracked |
| AI generation latency | None | ❌ Not tracked |
| RAG retrieval performance | Console logs only | ⚠️ Manual review |
| Database query times | Prisma logs (if enabled) | ⚠️ Not enabled by default |
| Usage events | `UsageMetric` table | ✅ App-level tracking |

### UsageMetric Table
The platform logs user activity events:
```typescript
{ event: 'generate', module: 'marketing', metadata: {...} }
```
This is the primary usage tracking mechanism, but it's for business analytics, not operational monitoring.

## Error Reporting

| Mechanism | Status |
|-----------|--------|
| Console.error in API routes | ✅ Present in all route handlers |
| Error response to client | ✅ JSON `{ error: "..." }` with HTTP status |
| Global error boundary | ❌ None |
| External error tracking (Sentry, etc.) | ❌ Not integrated |
| Uncaught exception handling | ❌ No global handler |

## AI-Specific Monitoring

| What | Status |
|------|--------|
| `AssistantQuestionLog` grounding status | ✅ Tracks VERIFIED/PARTIAL/NOT_FOUND |
| `KnowledgeGap` detection | ✅ Auto-detects ungrounded topics |
| Token usage per request | ❌ Not tracked |
| Model cost per request | ❌ Not tracked |
| Response quality scoring | ❌ Not implemented |
| Prompt length monitoring | ❌ Not implemented |

## Uptime Checks

- ❌ No health check endpoint
- ❌ No uptime monitoring service
- ⚠️ Vercel provides basic uptime monitoring on paid plans

## Alerting

- ❌ No alerting rules configured
- ❌ No PagerDuty/Slack/email alerts
- ⚠️ Supabase sends email alerts for database storage limits

## Dashboards

| Dashboard | Provider | Content |
|-----------|----------|---------|
| Supabase Dashboard | Supabase | DB size, connections, storage, auth stats |
| Vercel Dashboard | Vercel | Deployments, function invocations, errors |
| Backoffice Analytics | Built-in | Platform stats (companies, users, features) |
| OpenAI Dashboard | OpenAI | API usage, costs, rate limits |

## Recommended Improvements

1. **Structured logging** with JSON format and log levels
2. **Error tracking** service (Sentry recommended)
3. **Health check endpoint** (`/api/health`)
4. **AI cost monitoring** — track token usage and cost per generation
5. **Request tracing** — correlate requests with unique IDs
6. **Alerting** — critical error alerts via Slack or email
