# Nousio Assistant — Feature Documentation

> The Nousio Assistant is the platform's **always-available AI command layer**. It transforms natural language (text or voice) into structured actions across every module in the platform, turning Nousio from a collection of tools into a unified AI operating system.

---

## Table of Contents

1. [What It Is](#what-it-is)
2. [How It Works — Architecture](#how-it-works--architecture)
3. [The Orchestrator State Machine](#the-orchestrator-state-machine)
4. [Intent Classification](#intent-classification)
5. [Module Adapters](#module-adapters)
6. [Knowledge Grounding & Project Scope](#knowledge-grounding--project-scope)
7. [UI Components](#ui-components)
8. [Data Models](#data-models)
9. [RBAC & Permissions](#rbac--permissions)
10. [Skills Integration](#skills-integration)
11. [How It Integrates With the Platform](#how-it-integrates-with-the-platform)
12. [File Reference](#file-reference)

---

## What It Is

The Nousio Assistant is a **context-aware, multi-module AI agent** that runs as a slide-over panel accessible from every page in the platform. Users interact with it via:

- **Floating Action Button (FAB)** — bottom-right sparkles icon on every page
- **Keyboard shortcut** — `Ctrl+K` / `⌘K` from anywhere
- **Voice input** — built-in Whisper-powered speech-to-text

### Core Capabilities

| Capability | Description | Module |
|---|---|---|
| **Generate Content** | LinkedIn posts, blog ideas, newsletters, proposals, product specs | Marketing, Sales, Product |
| **Create Tasks** | Create one or many tasks on any board, with column/priority | Tasks |
| **Search Leads** | Find B2B leads by industry, region, or ICP criteria | Leads |
| **Query Knowledge** | Answer questions using the company's internal knowledge base (RAG) | Knowledge |
| **Navigate** | Take the user to any page in the platform | Navigation |
| **Summarize** | Summarize current page content or context | Knowledge |
| **Use Skills** | Auto-trigger installed community skills based on request match | Skills → Marketing |
| **Generate Designs** | Create visual brand assets, logos, and design concepts | Design |

---

## How It Works — Architecture

The assistant follows a **pipeline architecture** with 4 main layers:

```
User Input (text/voice)
        │
        ▼
┌─────────────────────┐
│   API Route          │  POST /api/assistant/message
│   (route.ts)         │  Authenticates user, resolves company
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Orchestrator       │  Core state machine
│   (orchestrator.ts)  │  Session mgmt, flow control
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Intent Classifier  │  GPT-powered NLU
│   (intent-           │  Maps natural language → structured intent
│    classifier.ts)    │  Returns: intentType, targetModule, params
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Module Adapters    │  One per module (marketing, sales, etc.)
│   (adapters/*.ts)    │  Executes the actual action
└─────────────────────┘
```

---

## The Orchestrator State Machine

The orchestrator (`orchestrator.ts`) manages the complete lifecycle of every user request through a well-defined state machine:

```
                    ┌─────────────────┐
                    │  User Message   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Resolve Project │  From pageContext or auth
                    │     Scope       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
               ┌─── │ Session Exists? │ ───┐
               │ No └─────────────────┘ Yes│
               │                           │
        ┌──────▼──────┐              ┌─────▼─────┐
        │ Create New  │              │  Resume   │
        │  Session    │              │  Session  │
        └──────┬──────┘              └─────┬─────┘
               │                           │
               └───────────┬───────────────┘
                           │
                  ┌────────▼────────┐
                  │   Responding to │ ──Yes──▶ handleConfirmation()
                  │   Confirmation? │           or handleClarification()
                  └────────┬────────┘
                        No │
                  ┌────────▼────────┐
                  │ Classify Intent │  GPT-powered
                  │   + Fetch SKills│  Injects boards, skills, project
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │   RBAC Check    │ ──Denied──▶ Permission error
                  └────────┬────────┘
                       OK  │
                  ┌────────▼────────┐
                  │ Missing Params? │ ──Yes──▶ WAITING_CLARIFICATION
                  │ Confidence < 0.5│          (ask user for details)
                  └────────┬────────┘
                       No  │
                  ┌────────▼────────┐
                  │ Needs Confirm?  │ ──Yes──▶ WAITING_CONFIRMATION
                  │ Confidence < 0.7│          (show summary, ask confirm)
                  └────────┬────────┘
                       No  │
                  ┌────────▼────────┐
                  │ Execute Action  │ ──▶ Adapter.execute()
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │   SUCCESS or    │  Returns: resultSummary,
                  │   FAILED        │  deepLink, inlinePreview,
                  └─────────────────┘  groundingStatus
```

### State Machine States

| State | Description | User Experience |
|---|---|---|
| `ACTIVE` | Session is open, no pending action | Free-form chat input |
| `WAITING_CLARIFICATION` | Missing required params or low confidence | Shows structured card with missing fields + quick options |
| `WAITING_CONFIRMATION` | All params present but action is destructive/uncertain | Shows confirm/cancel buttons |
| `SUCCESS` | Action completed | Green card with result summary, deep link, inline preview |
| `FAILED` | Action failed | Red card with error details |
| `PARTIAL_SUCCESS` | Action partially completed | Amber card with partial results |

---

## Intent Classification

The **Intent Classifier** (`intent-classifier.ts`) is a GPT-powered NLU layer that converts natural language into structured action intents.

### Input Context

The classifier receives rich context for accurate classification:

```typescript
{
    userMessage: string;           // The raw user input
    currentRoute: string;          // e.g., "/marketing"
    pageContext: Record;           // Page-specific metadata
    userRole: string;              // MEMBER, ADMIN, SUPER_ADMIN
    companyName: string;           // For grounding responses
    conversationHistory: [];       // Recent messages for context
    availableBoards: [];           // Task boards for matching
    availableSkills: [];           // Active skills for auto-triggering
    projectId?: string;            // Active project scope
    projectName?: string;          // Active project name
}
```

### Output: ClassifiedIntent

```typescript
{
    intentType: 'generate_content' | 'create_task' | 'search_leads' |
                'query_knowledge' | 'navigate' | 'summarize' | 'use_skill';
    targetModule: 'marketing' | 'sales' | 'product' | 'leads' |
                  'knowledge' | 'tasks' | 'navigation';
    targetAction: string;          // Specific action within module
    confidence: number;            // 0.0 - 1.0
    extractedParams: Record;       // Parsed parameters from the message
    missingParams: string[];       // What the user didn't provide
    requiresConfirmation: boolean; // Does this need explicit confirm?
    interpretation: string;        // Human-readable understanding
}
```

### Confidence Thresholds

| Confidence | Behavior |
|---|---|
| `< 0.5` | → Clarification (ask user to rephrase or provide details) |
| `0.5 – 0.7` | → Confirmation (show summary, ask to confirm) |
| `> 0.7` | → Direct execution (no extra prompts) |

---

## Module Adapters

Each module adapter implements a common interface and wraps the existing module's functionality:

```typescript
interface ModuleAdapter {
    name: string;              // e.g. "marketing"
    requiredParams: string[];  // Params that must be present
    optionalParams: string[];  // Params that enhance the output
    execute(params, auth): Promise<AdapterResult>;
}
```

### Available Adapters

| Adapter | File | Required Params | What It Does |
|---|---|---|---|
| **Marketing** | `adapters/marketing.ts` | `contentType`, `topic` | Generates marketing content (LinkedIn, blog, newsletter, etc.) using Company DNA + RAG context |
| **Sales** | `adapters/sales.ts` | `contentType`, `topic` | Generates sales content (outreach, proposals, follow-ups) |
| **Product** | `adapters/product.ts` | `contentType`, `topic` | Generates product docs (PRDs, specs, release notes) |
| **Leads** | `adapters/leads.ts` | `query` | Searches B2B leads via Apollo/LinkedIn enrichment APIs |
| **Knowledge** | `adapters/knowledge.ts` | `query` | Answers questions using RAG (wiki nodes + vector search) grounded in company knowledge |
| **Tasks** | `adapters/tasks.ts` | `boardName`, `title` | Creates tasks on Kanban boards, supports batch creation |
| **Navigation** | `adapters/navigation.ts` | `target` | Navigates user to a specific page |
| **Design** | `adapters/design.ts` | `designType`, `brief` | Generates visual design assets using AI |

### Adapter Result

Every adapter returns a standardized result:

```typescript
{
    success: boolean;
    resultSummary: string;      // Human-readable summary
    deepLink?: string;          // Link to view the result in-app
    inlinePreview?: string;     // Preview of generated content
    groundingStatus?: string;   // FULLY_GROUNDED, PARTIALLY_GROUNDED, etc.
    generatedId?: string;       // ID of created resource
    error?: string;
}
```

---

## Knowledge Grounding & Project Scope

### 3-Tier Knowledge Retrieval

When the assistant needs company context (for content generation or knowledge queries), it retrieves knowledge in a hierarchical scope:

```
Project-level knowledge (most specific)
    ↓ fallback
Customer-level knowledge
    ↓ fallback  
Company-level knowledge (broadest)
```

This means:
- If a user selects **Project X** and asks "What's our value proposition?", the assistant first looks for project-specific knowledge, then customer knowledge, then company-wide DNA.
- The `projectId` is resolved from the UI workspace selector or the current page context.

### Knowledge Sources

| Source | Description | Used By |
|---|---|---|
| **Company DNA** | Core positioning, values, tone, guardrails | All content adapters |
| **Wiki Nodes** | Structured knowledge entries | Knowledge adapter |
| **RAG (Vector Search)** | Semantic search over uploaded documents | Marketing, Sales, Knowledge |
| **Document Chunks** | Indexed document fragments | Knowledge queries |

### Grounding Status

Every knowledge-backed response includes a grounding indicator:

| Status | Meaning |
|---|---|
| `FULLY_GROUNDED` | Response is entirely based on company knowledge |
| `PARTIALLY_GROUNDED` | Response uses some company context + general knowledge |
| `UNGROUNDED` | No company knowledge found; response is generic |

---

## UI Components

### 1. ActionAssistantLauncher (`ActionAssistantLauncher.tsx`)

The global wrapper that renders:
- **FAB (Floating Action Button)** — bottom-right sparkles icon with keyboard shortcut hint
- **ActionAssistantPanel** — the slide-over panel

Present on every dashboard page via `layout.tsx`.

### 2. ActionAssistantPanel (`ActionAssistantPanel.tsx`)

The main interaction surface. Features:

| Feature | Description |
|---|---|
| **Chat Messages** | Scrollable message history with user/assistant bubbles |
| **Action Cards** | Structured UI cards for clarification, confirmation, and results |
| **Module Badges** | Color-coded badges showing which module is handling the request |
| **Quick Options** | Clickable option chips during clarification (e.g., board names) |
| **Deep Links** | "Open result" button that navigates to the created resource |
| **Inline Preview** | Shows generated content directly in the panel |
| **Voice Input** | Microphone button with Whisper transcription |
| **Session History** | Browse and resume previous conversations |
| **Suggestion Chips** | Pre-built prompts for first-time users |

### 3. Action Card States

The panel renders different card types based on the orchestrator state:

```
WAITING_CLARIFICATION  →  Yellow card with missing fields + quick options
WAITING_CONFIRMATION   →  Orange card with confirm/cancel buttons
SUCCESS                →  Green card with result + deep link + preview
FAILED                 →  Red card with error message
```

---

## Data Models

### AssistantSession

Tracks a conversation session:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Session identifier |
| `userId` | FK → User | Who started the session |
| `companyId` | FK → Company | Company context |
| `currentRoute` | String | Page where session started |
| `currentContextJson` | JSON | Page metadata |
| `status` | Enum | ACTIVE, COMPLETED, ABANDONED |

### AssistantMessage

Individual messages within a session:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Message identifier |
| `sessionId` | FK → Session | Parent session |
| `role` | Enum | USER, ASSISTANT, SYSTEM |
| `content` | Text | Message content |
| `inputMode` | Enum | TEXT, VOICE |

### AssistantActionRun

Tracks each action attempt and its lifecycle:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Action run identifier |
| `sessionId` | FK → Session | Parent session |
| `companyId` | FK → Company | Company context |
| `intentType` | String | generate_content, create_task, etc. |
| `targetModule` | String | marketing, sales, etc. |
| `targetAction` | String | Specific action within module |
| `confidenceScore` | Float | Classification confidence |
| `status` | Enum | WAITING_CLARIFICATION, WAITING_CONFIRMATION, SUCCESS, FAILED, PARTIAL_SUCCESS |
| `requestPayloadJson` | JSON | Extracted parameters |
| `resultPayloadJson` | JSON | Execution result |
| `resultLink` | String | Deep link to created resource |
| `groundingStatus` | String | Knowledge grounding level |

---

## RBAC & Permissions

The assistant enforces **role-based access control** per module:

| Module | Allowed Roles |
|---|---|
| Marketing | MEMBER, ADMIN, SUPER_ADMIN |
| Sales | MEMBER, ADMIN, SUPER_ADMIN |
| Product | MEMBER, ADMIN, SUPER_ADMIN |
| Leads | ADMIN, SUPER_ADMIN |
| Knowledge | MEMBER, ADMIN, SUPER_ADMIN |
| Tasks | MEMBER, ADMIN, SUPER_ADMIN |
| Navigation | MEMBER, ADMIN, SUPER_ADMIN |

If a user's role doesn't match, the assistant returns a permission error without executing.

---

## Skills Integration

The assistant can **auto-trigger installed community skills** when a user's request matches a skill's description. This works via:

1. **Skill Discovery** — On each request, the orchestrator fetches all active `AssistantSkill` entries for the company with non-null descriptions.
2. **Classification Injection** — Active skills are injected into the classifier's prompt as available options.
3. **Intent Routing** — If the classifier identifies `intentType: 'use_skill'` with a `matchedSkillKey`, the orchestrator reroutes it to the marketing adapter with the skill key as the content type.
4. **Chain Execution** — The skill's prompt chain is executed with the user's message as context.

This allows any community skill to become voice/text-accessible without custom wiring.

---

## How It Integrates With the Platform

### Platform Integration Map

```
┌──────────────────────────────────────────────────────────────────┐
│                     NOUSIO PLATFORM                              │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Today   │  │ Team    │  │Projects  │  │Knowledge │          │
│  │Dashboard│  │ Page    │  │& Boards  │  │Base      │          │
│  └────┬────┘  └────┬────┘  └─────┬────┘  └────┬─────┘          │
│       │            │             │             │                 │
│       │            │             │             │                 │
│  ┌────▼────────────▼─────────────▼─────────────▼──────────────┐ │
│  │              🌟 NOUSIO ASSISTANT (Global)                   │ │
│  │                                                             │ │
│  │  Available on EVERY page via FAB + Ctrl+K                   │ │
│  │  Reads page context (route, objectId, objectType)           │ │
│  │  Scopes actions to selected project                         │ │
│  │                                                             │ │
│  │  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ Marketing │ │  Sales   │ │ Product  │ │Lead Discovery│  │ │
│  │  │ Adapter   │ │ Adapter  │ │ Adapter  │ │   Adapter    │  │ │
│  │  └─────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘  │ │
│  │        │             │            │              │           │ │
│  │  ┌─────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌─────▼────────┐ │ │
│  │  │ Content   │ │ Email    │ │  PRD     │ │ Apollo/      │ │ │
│  │  │ Generator │ │ Writer   │ │ Builder  │ │ LinkedIn API │ │ │
│  │  └───────────┘ └──────────┘ └──────────┘ └──────────────┘ │ │
│  │                                                             │ │
│  │  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ Knowledge │ │  Tasks   │ │Navigation│ │   Design     │  │ │
│  │  │  Adapter  │ │ Adapter  │ │ Adapter  │ │   Adapter    │  │ │
│  │  └─────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘  │ │
│  │        │             │            │              │           │ │
│  │  ┌─────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌─────▼────────┐ │ │
│  │  │ RAG +     │ │  Kanban  │ │  Router  │ │  DALL-E /    │ │ │
│  │  │ Wiki +    │ │  Board   │ │  Push    │ │  Image Gen   │ │ │
│  │  │ DNA       │ │  API     │ │          │ │              │ │ │
│  │  └───────────┘ └──────────┘ └──────────┘ └──────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Boardroom │  │ Tasks    │  │Customers │  │ Settings/Config  │ │
│  │(Strategy)│  │(Kanban)  │  │(CRM)     │  │ (AI Brain)       │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Key Integration Points

| Integration | How |
|---|---|
| **Page Context** | The assistant reads `pathname` and sends it as `pageContext.route`, enabling context-aware responses |
| **Project Scope** | When a user selects a project in the workspace, `projectId` is forwarded through the entire pipeline |
| **Knowledge Base** | All content adapters call `retrieveWikiAndRAGContext()` with project scope for grounded output |
| **Task Boards** | The orchestrator pre-fetches all boards + columns so the classifier can match "create a task on Biometrics" correctly |
| **Community Skills** | Active skills are discovered and injected into classification so any skill becomes assistantable |
| **AI Team Members** | The assistant coexists with per-member chat (`AIAssistantChat.tsx`). Each AI team member has its own specialized chat, while the global assistant handles cross-module commands |
| **Today Dashboard** | `AssistantActionRun` records feed into the Updates and Analytics tabs |
| **Session Persistence** | Conversations are stored in `AssistantSession` + `AssistantMessage`, enabling history browsing |

### Assistant vs. AI Team Chat

| Feature | Global Assistant (FAB) | AI Team Member Chat |
|---|---|---|
| **Access** | `Ctrl+K` from any page | Navigate to `/team/[memberId]` |
| **Purpose** | Cross-module commands | Deep, specialized conversation |
| **Scope** | All modules | Single brain type (Marketing Lead, Sales, etc.) |
| **Context** | Page-aware, project-scoped | Member-specific + Company DNA |
| **UI** | Slide-over panel | Full-page chat workspace |
| **Model** | GPT-5.4-mini (fast) | Configurable per brain type |
| **Output** | Structured action cards | Rich conversational messages |

---

## File Reference

| File | Purpose |
|---|---|
| `src/lib/assistant/orchestrator.ts` | Core state machine — session management, flow control, execution |
| `src/lib/assistant/intent-classifier.ts` | GPT-powered NLU — classifies messages into structured intents |
| `src/lib/assistant/adapters/types.ts` | Shared interface for all module adapters |
| `src/lib/assistant/adapters/marketing.ts` | Marketing content generation adapter |
| `src/lib/assistant/adapters/sales.ts` | Sales content generation adapter |
| `src/lib/assistant/adapters/product.ts` | Product documentation adapter |
| `src/lib/assistant/adapters/leads.ts` | Lead discovery adapter |
| `src/lib/assistant/adapters/knowledge.ts` | Knowledge query (RAG) adapter |
| `src/lib/assistant/adapters/tasks.ts` | Task creation adapter |
| `src/lib/assistant/adapters/navigation.ts` | Page navigation adapter |
| `src/lib/assistant/adapters/design.ts` | Design generation adapter |
| `src/lib/assistant/adapters/index.ts` | Barrel exports |
| `src/components/ActionAssistantLauncher.tsx` | Global FAB + panel wrapper |
| `src/components/ActionAssistantPanel.tsx` | Main interaction UI (chat, cards, voice) |
| `src/components/ActionAssistant.css` | Panel styling (Dark OS) |
| `src/app/api/assistant/message/route.ts` | API route — receives messages, calls orchestrator |
| `src/app/api/assistant/sessions/route.ts` | API route — list session history |
| `src/app/api/assistant/preferences/route.ts` | API route — user assistant preferences |

---

*Last updated: April 2026*
