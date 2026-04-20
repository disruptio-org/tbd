# 01 — Product Overview

## What It Is

Nousio is an **AI-native enterprise intelligence platform** that transforms how companies interact with their business knowledge. It provides a multi-tenant SaaS platform where each company builds a proprietary AI intelligence layer using their own documents, profiles, and context.

## Why It Exists

Companies accumulate enormous amounts of institutional knowledge — documents, processes, positioning, customer data — but struggle to operationalize it. Nousio solves this by:

1. **Ingesting** company knowledge (documents, profiles, web context)
2. **Embedding** it into a vector-searchable knowledge base
3. **Powering** AI assistants that generate contextualized content grounded in that knowledge
4. **Enabling** teams to take action on AI-generated insights through tasks, CRM, and project management

## Who Uses It

| Persona | Role in Nousio |
|---------|----------------|
| **Company Admin** | Sets up the company, uploads documents, manages users and access groups |
| **Marketing User** | Uses the Marketing Assistant to generate campaigns, posts, email sequences |
| **Sales User** | Uses the Sales Assistant for proposals, outreach, objection handling |
| **Product Manager** | Uses the Product Assistant for PRDs, release notes, roadmaps |
| **General Employee** | Uses Ask AI Chat for company Q&A, Onboarding Assistant for orientation |
| **Super Admin** | Manages the entire platform via the Backoffice (multi-company) |

## Main Business Problem Solved

> **Bridge the gap** between a company's accumulated knowledge and the AI-powered actions its teams need to perform daily.

## Major Capabilities

### Knowledge Layer
- **Document Management**: Upload, organize (folders), tag, and manage company documents (PDF, DOCX, XLSX, images, markdown)
- **Content-Based Versioning**: SHA-256 hashing detects duplicates (same hash → 409 Conflict) and content updates (different hash → version increment)
- **OCR Lifecycle**: Status tracking (`PENDING` → `PROCESSING` → `PROCESSED` → `ERROR`) with error capture and manual reprocessing
- **Bulk Document Operations**: Select-all/multi-select with bulk actions — Reprocess, Category, Priority, Curated status, and Delete
- **External Document Sync**: Google Drive (OAuth) and Notion (Internal Integration Token) sync with auto-discovery
- **Knowledge Indexing**: Automatic text extraction (pdfjs-dist, Mammoth, notion-to-md, OCR) + chunking + embedding (OpenAI `text-embedding-3-small`)
- **Semantic Search**: RAG-powered full-text and vector search across company knowledge
- **Knowledge Gap Detection**: Auto-detects questions assistants can’t answer → surfaces knowledge gaps
- **Skill Library**: Zapier MCP integration for 35+ external tool actions (Gmail, Slack, Google Sheets, etc.)

### AI Assistants (Resources)
- **Dynamic Team Model**: All AI assistants are custom-created "team members" — no predefined types. Each member = one sidebar resource.
- **Custom Members**: Each team member is an `AIBrainProfile` with configurable personality, reasoning depth, formality, knowledge priority, and skills
- **Common Uses**: Marketing content, sales proposals, product PRDs, company advisory, onboarding guides, developer assistance — all grounded in company knowledge
- **Action Assistant**: Voice-first AI that routes intents to modules (create tasks, search leads, navigate)
- **Sidebar Resources**: The RESOURCES sidebar section is fully dynamic — only team members that exist in the AI Team appear as sidebar links

### Operations
- **CRM**: Pipeline management with leads, contacts, activities, lifecycle tracking
- **Task Boards**: Kanban boards with columns, checklists, comments, activity logs, file attachments
- **Projects/Workspaces**: Organize work by client or initiative
- **Data Extraction (Classifications)**: Define custom AI extraction schemas, run against documents

### Administration
- **Access Groups**: RBAC system with feature-level and sub-feature-level permissions
- **User Management**: Invite users, assign roles (MEMBER, ADMIN), provision passwords
- **Company Settings**: Profile, language, branding
- **Backoffice**: Super admin panel for multi-company management, feature toggles, licensing, analytics

## How Users Interact

1. **Onboarding Setup Wizard** (6 steps): Company profile → Business context → Upload documents → Review → Generate onboarding guide → Complete
2. **Dashboard**: Central hub showing recent conversations, tasks, quick actions
3. **Sidebar Navigation**: Dynamic RESOURCES section showing only active AI team members + static modules (Chat, Documents, CRM, Tasks, etc.)
4. **AI Chat Interface**: Conversational UI with markdown rendering, voice input (Whisper), RAG context injection
5. **Generation Runs**: Each assistant creates "runs" (generation history) and "drafts" (saved outputs)
6. **Backoffice**: Separate admin interface for platform-wide management

## Main Workflows

### 1. Knowledge Building
```
Upload Docs / Sync External Sources → Extract Text → Chunk → Generate Embeddings → Store in DocumentEmbedding
```

### 2. AI Content Generation
```
User Input → RAG Retrieval → Context Injection → LLM Generation → Save Run/Draft
```

### 3. Company Onboarding
```
Create Company (Backoffice) → User Login → Setup Wizard → Profile + Docs + Guide → Dashboard
```

### 4. Access Control
```
Create Access Groups → Assign Permissions → Add Users → Login → Resolve Effective Access
```

## Boundaries: What Nousio Does NOT Do

- **Not a general-purpose CMS**: It doesn’t host or serve public content
- **Not a standalone CRM**: CRM is lightweight pipeline management, not Salesforce
- **Not a workflow automation engine**: Workflows exist in schema but are not fully implemented
- **Not a data warehouse**: No ETL, no BI dashboards
- **No real-time collaboration**: No live co-editing of documents or tasks
- **No native mobile app**: Web-only (responsive)
- **No self-hosted installation**: Runs on managed infrastructure (Supabase + Vercel/VM)
