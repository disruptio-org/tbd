# 01 — Technical Roadmap

## Upcoming Modules

### High Priority
| Module | Description | Dependencies |
|--------|-------------|-------------|
| **Background Job Queue** | BullMQ/Redis for async processing (embeddings, AI generation, file processing) | Redis infrastructure |
| **Email Notifications** | SMTP integration for user invitations, password resets, task notifications | Email provider (SendGrid/SES) |
| **Audit Log** | Comprehensive admin action logging for compliance and debugging | Schema additions |
| **Diary Feature** | Voice note recording → Whisper transcription → GPT structuring → diary entries | Already designed, partial schema |

### Medium Priority
| Module | Description | Dependencies |
|--------|-------------|-------------|
| **Calendar Integration** | Task scheduling, habit tracking, calendar view | Calendar API (Google/Outlook) |
| **Habit Tracker** | Daily habits with streaks, categories, time-of-day organization | New schema models |
| **Advanced CRM** | Deal values, forecasting, custom fields, email integration | CRM schema extensions |
| **Invoice Processing** | OCR + AI extraction of invoice data → business rules engine | Classification enhancements |

## Implemented Integrations

| Integration | Status | Priority |
|------------|--------|----------|
| Google Drive | ✅ Implemented | — OAuth sync, folder selection, auto-embed |
| Notion | ✅ Implemented | — Internal Integration Token, auto-discovery, block fallback |
| Zapier MCP | ✅ Implemented | — 35+ external tool actions via MCP protocol |

## Planned Integrations

| Integration | Status | Priority |
|------------|--------|----------|
| Slack | Planned | Medium — notifications, task updates |
| SharePoint | Planned | Medium — document sync from Microsoft ecosystem |
| HubSpot/Salesforce | Planned | Low — bi-directional CRM sync |
| Email (SMTP) | In design | High — notifications |
| Webhooks (outbound) | Planned | Low — event notifications |

## Infrastructure Evolution

| Improvement | Current | Target |
|------------|---------|--------|
| Job queue | None (synchronous) | BullMQ + Redis for async AI/embedding |
| Caching | None | Redis for frequent queries, AI responses |
| Vector search | In-memory cosine similarity | pgvector native similarity search |
| Logging | Console.log | Structured JSON logging |
| Error tracking | None | Sentry or similar |
| Monitoring | None | Health checks + alerting |

## AI Improvements

| Improvement | Description |
|------------|-------------|
| **Streaming responses** | Stream AI responses for better UX in all assistants |
| **Cross-encoder reranking** | Better retrieval quality with reranking model |
| **Semantic chunking** | Split documents by meaning, not fixed word count |
| **Token budget management** | Track token usage and enforce limits |
| **Prompt versioning** | Version control for system prompts |
| **A/B testing** | Test different prompts for quality comparison |
| **Model routing** | Intelligent model selection based on task complexity |

## Scalability Priorities

1. **Move AI processing to background jobs** — unblock HTTP requests
2. **pgvector native queries** — replace in-memory similarity search
3. **Redis caching** — reduce database load for frequent queries
4. **Connection pooling optimization** — handle more concurrent users
5. **Component library** — extract shared UI components for consistency

## Security Improvements

1. **Multi-factor authentication** (TOTP/SMS via Supabase)
2. **API rate limiting** (per-user, per-route)
3. **Input sanitization** for prompt injection prevention
4. **Signed URLs** with expiration for document access
5. **Admin audit trail** in database
