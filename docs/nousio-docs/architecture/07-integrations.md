# 07 — Integrations

## External Services

### OpenAI (Critical)
| Integration | Direction | Usage |
|------------|-----------|-------|
| Chat Completion | Outbound | Content generation (all assistants) |
| Embeddings | Outbound | Document vectorization, query embedding |
| Whisper | Outbound | Voice-to-text transcription |
| **Auth**: API key (`OPENAI_API_KEY`) | — | Single key for all services |
| **Failure handling**: Silent fallback (empty RAG), error response on generation failure | — | — |

### Supabase (Critical)
| Service | Direction | Usage |
|---------|-----------|-------|
| Auth | Bidirectional | User authentication, JWT, session management |
| PostgreSQL | Bidirectional | Primary data store (via Prisma + Supabase JS) |
| Storage | Bidirectional | Document file storage (upload/download/delete) |
| **Auth**: Service role key + anon key | — | — |
| **Failure handling**: 500 errors propagated to user | — | — |

### Google OAuth (Optional)
| Integration | Direction | Usage |
|------------|-----------|-------|
| OAuth 2.0 | Outbound | Social login via Supabase Auth provider |
| **Auth**: Client ID + Client Secret (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | — | — |
| **Failure handling**: Graceful fallback to email/password login | — | — |

### Google Drive (Implemented)
| Integration | Direction | Usage |
|------------|-----------|-------|
| OAuth 2.0 | Outbound | Company-level authorization to access Drive folders |
| Drive API v3 | Outbound | List folders, list files, download file content |
| **Auth**: OAuth flow via `CompanyIntegration.oauthTokens` (per-company, stored in DB) | — | — |
| **Sync**: Configurable frequency (1h/6h/12h/24h/manual), folder selection in Settings | — | — |
| **Adapter**: `src/lib/document-sources/google-drive.ts` implements `DocumentSourceAdapter` | — | — |
| **Data flow**: Google Docs → exported as DOCX → text extracted → embedded | — | — |

### Notion (Implemented)
| Integration | Direction | Usage |
|------------|-----------|-------|
| Internal Integration Token | Outbound | Company-level access to shared Notion pages |
| Notion API (pages, blocks) | Outbound | List pages, extract content, sync |
| `notion-to-md` | Internal | Convert Notion blocks to Markdown |
| **Auth**: Internal Integration Token pasted by admin → stored in `CompanyIntegration.oauthTokens.accessToken` | — | — |
| **Sync**: Auto-discovers all accessible pages; no OAuth redirect flow needed | — | — |
| **Adapter**: `src/lib/document-sources/notion.ts` implements `DocumentSourceAdapter` | — | — |
| **Fallback**: If `notion-to-md` returns empty, a block-level extraction reads text from paragraphs, headings, lists, callouts, toggles, code, and page properties directly via Notion Blocks API | — | — |

### Zapier MCP (Implemented)
| Integration | Direction | Usage |
|------------|-----------|-------|
| MCP Protocol | Bidirectional | Discovers and executes external tools from Zapier ecosystem |
| **Auth**: MCP endpoint URL with embedded token per company | — | — |
| **Adapter**: Fetches available MCP tools → creates `Skill` records → surfaced in Skill Library | — | — |
| **Scope**: 35+ actions available (Gmail, Slack, Google Sheets, etc.) | — | — |

## Document Source Adapter Pattern

All external document providers implement the `DocumentSourceAdapter` interface (`src/lib/document-sources/types.ts`):

```typescript
interface DocumentSourceAdapter {
  readonly provider: string;
  getAuthUrl(state: string): string;
  handleCallback(code: string): Promise<OAuthTokens>;
  refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
  listFolders(tokens: OAuthTokens, parentId?: string): Promise<ExternalFolder[]>;
  listFiles(tokens: OAuthTokens, folderId: string): Promise<ExternalFile[]>;
  downloadFile(tokens: OAuthTokens, fileId: string, mimeType: string): Promise<{ buffer: Buffer; exportedMimeType: string }>;
  getFileMetadata(tokens: OAuthTokens, fileId: string): Promise<FileMetadata>;
}
```

The ingestion pipeline (`src/lib/document-sources/ingestion.ts`) orchestrates:
1. Fetch selected folders from `CompanyIntegration.config`
2. For each folder → `listFiles()` → for each file → `downloadFile()` → `extractTextFromBuffer()` → `embedDocument()`
3. Results stored in `ExternalDocument` table with content hash for incremental sync

## Internal Integration Patterns

### Web Scraping (Backoffice → Company Context)
- Backoffice admin can trigger website scraping for a company
- Scrapes company website URL → extracts text → stores as `Company.webContext`
- Used as additional AI context for all assistants

### Cross-Module Task Creation
Tasks can be created from any module, tracked via `Task.sourceType`:
- `CHAT_MESSAGE`: From AI chat conversations
- `DOCUMENT`: From document analysis
- `KNOWLEDGE_GAP`: From knowledge gap detection
- `PRODUCT_RUN`: From product assistant output
- `MARKETING_DRAFT` / `SALES_DRAFT`: From assistant drafts
- `VOICE_AI`: From Action Assistant voice commands

### Lead Discovery → CRM
- Lead Discovery searches generate `LeadResult` records
- Leads can be imported into CRM as `CrmLead` with `sourceType: LEAD_DISCOVERY`
- One-directional sync (discovery → CRM, no back-sync)

## Future Integrations (Not Yet Implemented)

| Integration | Status | Purpose |
|------------|--------|---------|
| Slack | Planned | Notifications, task updates |
| Email (SMTP) | Planned | User invitations, notifications |
| Calendar | Planned | Task scheduling, meetings |
| CRM sync (HubSpot/Salesforce) | Planned | Bi-directional CRM data sync |
| SharePoint | Planned | Document sync from Microsoft ecosystem |
| Webhooks (outbound) | Planned | Event notifications to external systems |

## Mapping Rules

| External Entity | Internal Entity | Mapping |
|----------------|----------------|---------|
| Supabase Auth User | `User` table | Matched by email, synced via `ensureDbUser()` |
| Supabase Storage file | `Document.storageKey` | Path: `documents/{companyId}/{uuid}-{filename}` |
| OpenAI embedding response | `DocumentEmbedding.embedding` | Stored as JSON string of 1536-dim vector |
| Google Drive file | `ExternalDocument` | Mapped by `externalId` (Drive file ID), content hash for dedup |
| Notion page | `ExternalDocument` | Mapped by `externalId` (Notion page UUID), content exported as Markdown |
| Zapier MCP tool | `Skill` | Mapped by MCP tool name, stored with `sourceType: ZAPIER_MCP` |
