# Context Creation & Management — Functional Requirements

> **Document version**: 1.0  
> **Last updated**: 2026-04-15  
> **Scope**: All mechanisms by which contextual information is created, stored, assembled, and injected into AI prompts across the Disruptio/Nousio platform.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Context Sources & Data Model](#2-context-sources--data-model)
3. [FR-100: Company Profile Context](#fr-100-company-profile-context)
4. [FR-200: Project Context](#fr-200-project-context)
5. [FR-300: Company DNA & Knowledge Graph](#fr-300-company-dna--knowledge-graph)
6. [FR-400: Document-Based RAG Context](#fr-400-document-based-rag-context)
7. [FR-500: Wiki Context](#fr-500-wiki-context)
8. [FR-600: Web Context](#fr-600-web-context)
9. [FR-700: AI Brain Configuration Context](#fr-700-ai-brain-configuration-context)
10. [FR-800: Skill-Specific Context](#fr-800-skill-specific-context)
11. [FR-900: Session & Conversation Context](#fr-900-session--conversation-context)
12. [FR-1000: Boardroom Orchestration Context](#fr-1000-boardroom-orchestration-context)
13. [FR-1100: Context Assembly & Injection Pipeline](#fr-1100-context-assembly--injection-pipeline)
14. [FR-1200: Structured Intake Context](#fr-1200-structured-intake-context)
15. [Context Assembly Hierarchy](#context-assembly-hierarchy)
16. [Data Tables Reference](#data-tables-reference)

---

## 1. Overview

The Nousio platform uses a **multi-layered context system** to enrich every AI interaction with relevant company, project, and user data. Context flows through multiple stages:

1. **Creation** — User inputs, document uploads, web scraping, or AI-generated synthesis.
2. **Storage** — Persisted across multiple database tables (Company, CompanyProfile, Project, KnowledgeNode, DocumentEmbedding, etc.).
3. **Retrieval** — Selected at runtime via scoped queries, semantic search (RAG), or keyword matching (Wiki).
4. **Assembly** — Merged into a composite prompt injected into AI system messages.
5. **Consumption** — Used by AI team members, the Action Assistant, Boardroom planner, and all generation endpoints.

### Context Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CONTEXT SOURCES                               │
├──────────────┬──────────────┬──────────────┬────────────┬────────────┤
│ Company      │ Project      │ Documents    │ Web        │ Brain      │
│ Profile      │ Context      │ (RAG/Wiki)   │ Scrape     │ Config     │
└──────┬───────┴──────┬───────┴──────┬───────┴─────┬──────┴─────┬──────┘
       │              │              │             │            │
       ▼              ▼              ▼             ▼            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   CONTEXT ASSEMBLY PIPELINE                          │
│  1. Company Profile     (always)                                     │
│  2. Project Context     (when scoped to project)                     │
│  3. Company DNA/Wiki    (structured knowledge)                       │
│  4. RAG Chunks          (semantic document search)                   │
│  5. Web Context         (scraped website summary)                    │
│  6. Brain Identity      (tone, guardrails, personality)              │
│  7. Skill Instructions  (per-skill prompts & placeholders)           │
│  8. Session History     (last N conversation messages)               │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   AI CONSUMERS                                       │
│  Action Assistant │ Team Members │ Boardroom │ Skill Runtime         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Context Sources & Data Model

| Context Layer | DB Table(s) | Created By | Scope |
|---|---|---|---|
| Company Profile | `CompanyProfile` | Setup Wizard / Settings | Company-wide |
| Company Record | `Company` (name, website, webContext) | Onboarding / Backoffice | Company-wide |
| Project Context | `Project` (contextText) | Document analysis / Manual | Per project |
| Company DNA | `CompanyDNA`, `KnowledgeNode`, `KnowledgeEdge` | Document ingestion pipeline | Company / Project / Customer |
| Document Embeddings | `DocumentEmbedding`, `Document`, `ExternalDocument` | Upload + OCR + Embedding | Company-wide |
| Wiki Pages | `KnowledgeNode` (compiled from DNA) | DNA compilation pipeline | Company / Project |
| Web Context | `Company.webContext` | Backoffice web scraper | Company-wide |
| Brain Configuration | `AIBrainProfile.configJson` | AI Brain settings UI | Per team member |
| Skill Instructions | `AssistantSkill.instructionPrompt` | Skill manager / Import | Per skill |
| Session & History | `AssistantSession`, `AssistantMessage` | Runtime (auto-created) | Per session |
| Boardroom Plan | `BoardroomInitiative`, `BoardroomTask` | Boardroom planner | Per initiative |

---

## FR-100: Company Profile Context

### FR-101: Company Profile Creation (Onboarding)

**Source**: `src/app/setup/page.tsx`  
**API**: `PUT /api/company/profile`

The platform SHALL provide a guided setup wizard with a multi-step onboarding flow that collects:

| Field | Required | Description |
|---|---|---|
| `companyName` | ✅ | Legal or brand name |
| `description` | ✅ | Free-text company description |
| `industry` | | Industry vertical |
| `website` | | Company URL |
| `foundedYear` | | Year of founding |
| `productsServices` | | Products/services description |
| `mainOfferings` | | Primary offerings |
| `valueProposition` | | Core value proposition |
| `targetCustomers` | | ICP / buyer personas |
| `targetIndustries` | | Verticals served |
| `markets` | | Geographic or segment markets |
| `departments` | | Internal department structure |
| `internalTools` | | Tools used internally |
| `keyProcesses` | | Key operational processes |
| `competitors` | | Known competitors |
| `strategicGoals` | | Business objectives |
| `brandTone` | | Brand voice / tone guidance |

### FR-102: Company Profile as Context Input

**Source**: `src/lib/assistant-generate.ts` (lines 161–194), `src/lib/assistant/adapters/marketing.ts` (lines 50–64)

The system SHALL load and inject the `CompanyProfile` record into every AI generation prompt when no project scope is active. The assembled context block SHALL include all non-null profile fields, prefixed with `=== COMPANY PROFILE ===`.

When a `projectId` is active, the system SHALL skip the company profile and inject **project context** instead (see FR-200).

### FR-103: Company Profile Fallback

If no `CompanyProfile` record exists, the system SHALL fall back to the `Company` table's `name` and `website` fields as minimal context.

---

## FR-200: Project Context

### FR-201: Project Context Generation

**Source**: `src/app/api/projects/[id]/generate-context/route.ts`  
**API**: `POST /api/projects/{id}/generate-context`

The system SHALL support AI-assisted generation of project context by:

1. Fetching all `Document` records associated with the project that have non-null `extractedText`.
2. Truncating each document's text to **5,000 characters**.
3. Sending the concatenated document texts to GPT with a synthesis prompt that extracts:
   - Core objective
   - Target audience / demographics
   - Key value propositions / features
   - Tone of voice / brand guidelines
   - Critical constraints
4. Saving the generated context as `Project.contextText`.
5. Returning the updated project record.

**Pre-conditions**:
- At least one document with processed OCR text must exist.
- User must be authenticated and belong to the project's company.

**Error conditions**:
- No processed documents → HTTP 400 with descriptive message.
- AI generation failure → HTTP 500.

### FR-202: Project Context Injection

**Source**: `src/lib/assistant-generate.ts` (lines 163–169), `src/lib/assistant/adapters/knowledge.ts` (lines 37–59)

When a `projectId` is provided, the system SHALL:

1. Load `Project.name`, `Project.description`, and `Project.contextText`.
2. Assemble them into a `=== PROJECT CONTEXT ===` block.
3. Use this **instead of** the generic company profile context.

### FR-203: Project Context Resolution via Name Matching

**Source**: `src/lib/assistant/adapters/knowledge.ts` (lines 38–59), `src/lib/assistant/adapters/marketing.ts` (lines 67–83)

When no explicit `projectId` is provided but a `projectName` is detected (via parameter or NLP extraction from the user query), the system SHALL:

1. Fetch all projects for the company.
2. Perform **fuzzy name matching** (case-insensitive partial substring match).
3. Inject the matched project's context as `=== PROJECT DOCUMENTATION ===`.

### FR-204: Project Name Extraction from Queries

**Source**: `src/lib/assistant/adapters/knowledge.ts` (lines 118–129)

The system SHALL extract project names from user queries using regex patterns:
- `project X`, `produto X`, `projeto X`
- `of/from/on/about the X project/app/documentation`
- `look at the X project/documentation`

---

## FR-300: Company DNA & Knowledge Graph

### FR-301: Company DNA Record Management

**Source**: `src/lib/dna-builder.ts` (lines 105–133)

The system SHALL maintain a `CompanyDNA` record per company with:
- `id`, `companyId`, `version`, `coverageScore`, `lastProcessedAt`

If no DNA record exists, one SHALL be created automatically and seeded with **6 default resource groups**.

### FR-302: Default Resources Seeding

**Source**: `src/lib/dna-builder.ts` (lines 64–101, 138–163)

Upon first DNA creation, the system SHALL seed these resource groups:

| Resource | Node Types |
|---|---|
| Brand & Positioning | messaging, content_strategy |
| Sales Intelligence | persona, competitor, case_study, pricing |
| Market & Industry | market, competitor, metric |
| Product Knowledge | product, methodology, integration |
| Company Operations | policy, process |
| Performance & Strategy | metric, case_study, pricing |

### FR-303: Knowledge Node Upsert with Fuzzy Deduplication

**Source**: `src/lib/dna-builder.ts` (lines 167–251)

When ingesting extracted knowledge, the system SHALL:

1. Search for existing `KnowledgeNode` records of the same `type` within the same scope (project/customer).
2. Perform **fuzzy title matching** using:
   - Normalized exact match (lowercase, stripped special chars).
   - Substring containment.
   - Levenshtein distance < 30% for titles under 40 characters.
3. If a match is found → **merge** content fields (arrays are deduplicated, first-source-wins for strings), increment source boost, and recalculate confidence.
4. If no match → **create** a new node with auto-generated summary.

### FR-304: Knowledge Edge Management

**Source**: `src/lib/dna-builder.ts` (lines 255–286)

The system SHALL support directed edges between knowledge nodes:
- Edge creation with default strength `0.5`.
- Edge strengthening (+0.1 per repeat occurrence, capped at 1.0).
- Deduplication on `(fromNodeId, toNodeId, relationType)`.

### FR-305: Coverage Score Calculation

**Source**: `src/lib/dna-builder.ts` (lines 290–329)

The system SHALL recalculate a weighted coverage score based on a **13-type taxonomy**:

| Type | Weight | Expected Count |
|---|---|---|
| product | 0.15 | 3 |
| persona | 0.10 | 3 |
| messaging | 0.10 | 2 |
| case_study | 0.10 | 3 |
| market | 0.08 | 2 |
| process | 0.08 | 4 |
| competitor | 0.07 | 3 |
| pricing | 0.07 | 2 |
| content_strategy | 0.05 | 1 |
| methodology | 0.05 | 2 |
| metric | 0.05 | 3 |
| integration | 0.05 | 2 |
| policy | 0.05 | 3 |

Score = Σ (weight × min(actualCount / expectedCount, 1.0)), rounded to 2 decimals.

### FR-306: DNA Context Retrieval (3-Tier Scoping)

**Source**: `src/lib/rag-retrieval.ts` (lines 240–320)

When a `projectId` is provided, the system SHALL retrieve DNA nodes in priority order:

1. **Tier 1**: Project-specific nodes (`projectId = X`).
2. **Tier 2**: Customer-level nodes (if the project has a `customerId`).
3. **Tier 3**: Company-wide nodes (`projectId IS NULL AND customerId IS NULL`).

Each tier fills remaining slots (up to `maxNodes`, default 10). Nodes are filtered by `minConfidence` (default 0.4) and sorted by `confidenceScore DESC`.

### FR-307: DNA Context Formatting

**Source**: `src/lib/rag-retrieval.ts` (lines 326–343)

DNA nodes SHALL be formatted as:
```
=== COMPANY INTELLIGENCE (structured knowledge from Company DNA) ===
[TYPE: Title] (confidence: XX%)
  Field Name: value
  ...
=== END COMPANY INTELLIGENCE ===
```

---

## FR-400: Document-Based RAG Context

### FR-401: Query Embedding Generation

**Source**: `src/lib/rag-retrieval.ts` (lines 60–86)

For each retrieval query, the system SHALL:
1. Generate a query embedding using `text-embedding-3-small`.
2. Fetch all `DocumentEmbedding` records for the company.
3. Compute cosine similarity against each stored embedding.

### FR-402: Composite Scoring & Ranking

**Source**: `src/lib/rag-retrieval.ts` (lines 96–162)

Each candidate chunk SHALL be scored using a composite algorithm:
- **Base**: Cosine similarity score.
- **Knowledge source boost**: +0.15 if `useAsKnowledgeSource = true`.
- **Priority boost**: +0.10 (critical), +0.05 (preferred).
- **Recency boost**: +0.03 if updated within 30 days.
- **Noise penalty**: -0.10 for chunks < 50 characters.

### FR-403: Diversity & Deduplication

**Source**: `src/lib/rag-retrieval.ts` (lines 166–192)

The system SHALL enforce:
- Maximum chunks per document: `maxChunksPerDoc` (default 3).
- Minimum chunk length: 30 characters.
- Near-duplicate rejection (same document + first 80 chars match).
- Total cap at `maxChunks` (default 8).

### FR-404: RAG Context Formatting

**Source**: `src/lib/rag-retrieval.ts` (lines 205–213)

RAG chunks SHALL be formatted as:
```
=== COMPANY KNOWLEDGE BASE (automatically retrieved relevant information) ===
[Knowledge Source 1 — filename (category)]
chunk text...
---
[Knowledge Source 2 — filename]
chunk text...
=== END COMPANY KNOWLEDGE BASE ===
```

### FR-405: External Document Support

**Source**: `src/lib/rag-retrieval.ts` (lines 112–124)

The system SHALL support both internal `Document` and `ExternalDocument` records as RAG sources, using `externalDocumentId` as the join key when present.

---

## FR-500: Wiki Context

### FR-501: Wiki Page Retrieval

**Source**: `src/lib/wiki/retriever.ts` (lines 35–109)

The system SHALL retrieve compiled wiki pages (stored as `KnowledgeNode` records) using:

1. Base query: active status, minimum confidence (default 0.3), excluding system types (`wiki_index`, `wiki_log`).
2. Optional filters: entity types, project scope.
3. Client-side **relevance ranking** based on keyword matching.

### FR-502: Relevance Scoring Algorithm

**Source**: `src/lib/wiki/retriever.ts` (lines 132–188)

Query terms are extracted by removing stop words and normalizing. Relevance is computed as:
- **Title match**: weight 3 per term.
- **Summary match**: weight 2 per term.
- **Content match**: weight 1 per term.

Final score = `(score / (terms * 3)) * 0.7 + coverageRatio * 0.3`.

### FR-503: Coverage Level Classification

**Source**: `src/lib/wiki/retriever.ts` (lines 95–98)

| Pages Retrieved | Coverage Level |
|---|---|
| ≥ 3 | `full` |
| ≥ 1 | `partial` |
| 0 | `none` |

### FR-504: Wiki Context Formatting

**Source**: `src/lib/wiki/retriever.ts` (lines 116–128)

Wiki pages SHALL be formatted as:
```
=== COMPANY WIKI (compiled knowledge) ===
[Type Label: Title] (confidence: XX%)
  Field: value
  ...
=== END COMPANY WIKI ===
```

---

## FR-600: Web Context

### FR-601: Web Context Generation (Web Scraping)

**Source**: `src/app/api/backoffice/companies/[id]/scrape-web/route.ts`

The system SHALL support scraping a company's website and generating a structured summary via AI, stored as `Company.webContext`.

### FR-602: Web Context Injection

**Source**: Multiple consumers (assistant-generate.ts, marketing adapter, sales route, product route, boardroom command, etc.)

When `Company.webContext` is non-null, the system SHALL inject it into AI prompts as:
```
Web Context:
{webContext content}
```

or in Boardroom mode:
```
About: {webContext content}
```

This field is consumed by **all major generation endpoints**: chat, marketing, sales, product, leads, boardroom planning, and task execution.

---

## FR-700: AI Brain Configuration Context

### FR-701: Brain Config Structure

**Source**: `src/lib/ai-brains/build-brain-prompt.ts`

Each AI team member's brain is configurable with a structured `BrainConfig`:

| Section | Parameters |
|---|---|
| **Identity** | tonePreset, communicationStyle, formality, warmth, assertiveness, creativity, humor, brandStrictness |
| **Reasoning** | depth, speedVsThoroughness, proactiveness, challengeLevel, recommendationStrength, askWhenUncertain, provideOptions, explainReasoning, useStructuredResponses, bestEffortBias |
| **Knowledge** | preferInternalSources, preferCuratedSources, useCompanyProfile, citationStrictness, allowPartialAnswers, answerOnlyWhenGrounded, requireGroundingForSensitiveTopics |
| **Guardrails** | avoidInventingData, flagUncertainty, avoidLegalAdvice, avoidFinancialAdvice, avoidHrSensitiveAssumptions, avoidPricingCommitments, avoidContractualCommitments, sensitiveTopics[], escalationInstruction, blockedBehaviors[], restrictedClaims[] |
| **Task Behavior** | detailLevel, actionOrientation, persuasion, educationalStyle, verbosity, summaryStyle |
| **Advanced** | additionalSystemInstructions, forbiddenPhrasing, preferredTerminology, roleSpecificNotes, outputExamples |

### FR-702: System Prompt Assembly Order

**Source**: `src/lib/ai-brains/build-brain-prompt.ts` (lines 62–228)

The brain system prompt SHALL be assembled in this order:
1. Platform safety rules (language, privacy, identity).
2. Identity & personality rules.
3. Reasoning & decision style.
4. Knowledge & search behavior.
5. Guardrails.
6. Output style / task behavior.
7. Assistant-specific context (role-based instructions).
8. Advanced instructions (custom instructions, forbidden phrasing, etc.).
9. Company profile context (injected by caller).
10. Source context — RAG/Wiki/DNA (injected by caller).

### FR-703: Dynamic Brain Config Fallback

**Source**: `src/lib/assistant-generate.ts` (lines 62–83)

When a brain type is not in the hardcoded `ASSISTANT_CONFIGS` map, the system SHALL:
1. Query `AIBrainProfile` for a matching `brainType`.
2. Extract `configJson.identity.systemPrompt` if available.
3. Fall back to a generic template: `"You are {name}, an AI assistant..."`.

### FR-704: Company DNA Brain Enrichment

**Source**: `src/lib/assistant-generate.ts` (lines 200–238)

When `assistantType === 'COMPANY'`, the system SHALL additionally inject:
- DNA Identity: tone preset, communication style, personality traits.
- Team Structure: operating model, collaboration model.
- Team Member names (from all `AIBrainProfile` records).

### FR-705: Temperature Mapping

**Source**: `src/lib/ai-brains/build-brain-prompt.ts` (lines 280–284)

Creativity slider (0–10) SHALL map to temperature: `0.1 + (creativity / 10) * 0.8`.

---

## FR-800: Skill-Specific Context

### FR-801: Skill Instruction Prompt Resolution

**Source**: `src/lib/assistant-generate.ts` (lines 256–331)

For each content generation request, the system SHALL:
1. Look up `AssistantSkill` by `key` (lowercase content type), `companyId`, and `status = ACTIVE`.
2. If an `instructionPrompt` exists, inject it as `=== SKILL-SPECIFIC INSTRUCTIONS ===`.

### FR-802: Argument Substitution

**Source**: `src/lib/assistant-generate.ts` (lines 271–274)

Skill instructions SHALL support argument substitution:
- `$ARGUMENTS` → full topic string.
- `$ARGUMENTS[N]` or `$N` → Nth word-token from the topic.

### FR-803: Dynamic Placeholder Resolution

**Source**: `src/lib/assistant-generate.ts` (lines 278–319)

Skill instructions SHALL support `!{PLACEHOLDER}` tokens that resolve at runtime:

| Placeholder | Source |
|---|---|
| `!{COMPANY_PRODUCTS}` | CompanyProfile.productsServices / mainOfferings |
| `!{COMPANY_OFFERINGS}` | CompanyProfile.mainOfferings / productsServices |
| `!{COMPANY_VALUE_PROP}` | CompanyProfile.valueProposition |
| `!{COMPANY_CUSTOMERS}` | CompanyProfile.targetCustomers |
| `!{COMPANY_GOALS}` | CompanyProfile.strategicGoals |
| `!{COMPANY_INDUSTRIES}` | CompanyProfile.targetIndustries |
| `!{COMPANY_COMPETITORS}` | CompanyProfile.competitors |
| `!{RECENT_DOCS}` | Last 10 CompanyDocument name+description |
| `!{RECENT_DOCUMENTS}` | Same as RECENT_DOCS |
| `!{TEAM_NOTES}` | Last 5 GeneralAIGenerationRun title+output |

### FR-804: Default Parameter Application

**Source**: `src/lib/assistant-generate.ts` (lines 322–327)

If a skill has `defaultParams` (tone, audience, length) and the user has not provided them, the system SHALL apply the defaults.

---

## FR-900: Session & Conversation Context

### FR-901: Session Creation

**Source**: `src/lib/assistant/orchestrator.ts` (lines 177–188)

The system SHALL auto-create an `AssistantSession` when no `sessionId` is provided:
- `id`: UUID
- `userId`, `companyId`
- `currentRoute`: The page the user is on.
- `currentContextJson`: Full page context (route, objectId, objectType, pageTitle).
- `status`: `ACTIVE`.

### FR-902: Message History

**Source**: `src/lib/assistant/orchestrator.ts` (lines 852–860)

The system SHALL maintain conversation history in `AssistantMessage` and retrieve the **last 6 messages** (ascending order) for injection into intent classification prompts.

### FR-903: Page Context Awareness

**Source**: `src/lib/assistant/orchestrator.ts` (lines 29–38, 216–226)

Every orchestrator request SHALL include `pageContext`:
- `route`: Current URL path.
- `objectId`: ID of the entity being viewed (optional).
- `objectType`: Type of entity (e.g. `project`).
- `pageTitle`: Human-readable page title.

This context is passed to the intent classifier and used for:
- Resolving project scope (if `objectType === 'project'`).
- Page-aware intent classification.

### FR-904: Project Scope Resolution

**Source**: `src/lib/assistant/orchestrator.ts` (lines 166–174)

The system SHALL resolve the active project scope by:
1. Using `auth.projectId` if set.
2. Falling back to `pageContext.objectId` when `objectType === 'project'`.
3. Looking up the project name for injection into the classifier prompt.

---

## FR-1000: Boardroom Orchestration Context

### FR-1001: Orchestrator System Prompt Assembly

**Source**: `src/lib/boardroom/prompts.ts` (lines 20–154)

The Boardroom planner's context SHALL include:
1. **Company context** (profile + web context).
2. **Wiki context** (if available).
3. **Team members with skills**: Each member listed with `id`, `name`, `brainType`, description, and full skill list (id, key, name, description).
4. **Governance rules**: Approval gates, DAG dependencies, no circular dependencies.
5. **Task quality requirements**: 3+ sentence descriptions, specific deliverables with format/quantity, measurable acceptance criteria.
6. **Work-type specific guidance**: Detailed instructions for website, campaign, content, feature, lead discovery, and research tasks.

### FR-1002: User Command Context

**Source**: `src/lib/boardroom/prompts.ts` (lines 161–177)

The Boardroom user message SHALL include:
1. The raw user command.
2. Optional project context.
3. Optional clarification answers from the pre-planning questionnaire (label + question + answer).

---

## FR-1100: Context Assembly & Injection Pipeline

### FR-1101: Unified Retrieval Function

**Source**: `src/lib/rag-retrieval.ts` (lines 353–409)

The system SHALL provide `retrieveWikiAndRAGContext()` as the single entry point for all context retrieval:

1. **Wiki-first**: Try wiki retrieval. If `full` coverage → done.
2. **RAG supplement**: If wiki coverage is not `full`, supplement with RAG chunks.
3. **Combined grounding level**:
   - Wiki full → `VERIFIED`
   - Wiki partial → `PARTIAL`
   - Wiki partial + RAG → `VERIFIED`
   - RAG ≥ 3 chunks → `VERIFIED`
   - RAG < 3 chunks → `PARTIAL`
   - Nothing found → `NOT_FOUND`

### FR-1102: Context Assembly Order (Content Generation)

**Source**: `src/lib/assistant-generate.ts` (lines 161–371)

For content generation (team member chat, skill execution), context SHALL be assembled as:

1. **Base system role** (from brain config or assistant type).
2. **Skill-specific instructions** (if applicable, with placeholders resolved).
3. **Company profile** OR **Project context** (mutually exclusive).
4. **Company DNA identity** (for COMPANY brain type only).
5. **Wiki + RAG context** (via unified retrieval).
6. **Requirements block**: content type, language, tone, audience, goal, length.
7. **Rules block**: language enforcement, audience adaptation, grounding rules.

### FR-1103: Context Assembly Order (Knowledge Queries)

**Source**: `src/lib/assistant/adapters/knowledge.ts` (lines 29–79)

For knowledge/question-answering queries:
1. Wiki + RAG retrieval (up to 10 chunks, project-scoped if available).
2. Company profile (name + description only).
3. Project documentation (if project name detected).
4. Strict grounding rules: answer only from provided sources.

### FR-1104: Grounding Status Tracking

**Source**: `src/lib/assistant/adapters/knowledge.ts` (lines 62–65, 93–99)

Every knowledge query SHALL track grounding status:
- `VERIFIED`: Sources found and answer is grounded.
- `PARTIAL`: Some relevant information found.
- `NOT_FOUND`: No relevant sources available.

This status is persisted in `AssistantQuestionLog` and returned in the adapter result for UI display.

---

## FR-1200: Structured Intake Context

### FR-1201: Unstructured Text Parsing

**Source**: `src/lib/assistant/structured-intake.ts`

When user input is classified as `notes` or `mixed` type and exceeds 50 characters, the system SHALL parse it into structured data:

| Extracted Field | Description |
|---|---|
| `sourceType` | meeting_notes, brainstorm, action_list, general |
| `extractedTasks[]` | title, assignee, dueDate, priority |
| `extractedDecisions[]` | Conclusions and agreements |
| `extractedOwners[]` | People mentioned as responsible |
| `extractedDeadlines[]` | Dates/timeframes mentioned |
| `inferredProject` | Project name inferred from context |

### FR-1202: Intake Preview & Confirmation

**Source**: `src/lib/assistant/orchestrator.ts` (lines 421–476)

Parsed intake results SHALL be:
1. Presented to the user for review (`INTAKE_PREVIEW` status).
2. Stored as an `AssistantActionRun` with `requiresConfirmation = true`.
3. Only executed upon explicit user confirmation.

---

## Context Assembly Hierarchy

The following table defines which context sources are used by each consumer:

| Consumer | Company Profile | Project Context | DNA/Wiki | RAG | Web Context | Brain Config | Skill Instructions | Session History |
|---|---|---|---|---|---|---|---|---|
| Action Assistant (Orchestrator) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ |
| Intent Classifier | ✗ | ✅ (project scope) | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ (last 4) |
| Team Member Chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ |
| Knowledge Adapter | ✅ (name only) | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Marketing Adapter | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✅ | ✗ |
| Boardroom Planner | ✅ | ✅ | ✅ (wiki) | ✗ | ✅ | ✗ | ✗ | ✗ |
| Task Execution | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ |
| Handoff Adapter | ✗ | ✅ (pass-through) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## Data Tables Reference

### Primary Context Tables

| Table | Key Fields | Purpose |
|---|---|---|
| `Company` | name, website, webContext, language | Core company record |
| `CompanyProfile` | companyName, description, productsServices, valueProposition, targetCustomers, targetIndustries, markets, competitors, strategicGoals, departments, internalTools, keyProcesses, brandTone | Rich company context |
| `Project` | name, description, contextText, companyId, customerId | Project-level context |
| `CompanyDNA` | companyId, version, coverageScore, lastProcessedAt | DNA metadata |
| `KnowledgeNode` | companyId, dnaId, projectId, customerId, type, title, content, summary, confidenceScore, sourceDocumentIds, status | Knowledge graph nodes |
| `KnowledgeEdge` | fromNodeId, toNodeId, relationType, strength | Knowledge graph edges |
| `Resource` | companyId, name, description, icon, nodeTypes, isDefault | DNA resource groups |

### Document & Embedding Tables

| Table | Key Fields | Purpose |
|---|---|---|
| `Document` | companyId, projectId, filename, extractedText, knowledgeCategory, useAsKnowledgeSource, knowledgePriority | Internal documents |
| `ExternalDocument` | companyId, filename, knowledgeCategory, useAsKnowledgeSource, knowledgePriority | Imported external documents |
| `DocumentEmbedding` | companyId, documentId, externalDocumentId, chunkText, embedding | Vector embeddings |

### AI Configuration Tables

| Table | Key Fields | Purpose |
|---|---|---|
| `AIBrainProfile` | companyId, brainType, name, configJson, status | Team member brain config |
| `AssistantSkill` | companyId, key, name, instructionPrompt, requiredInputs, defaultParams, importMode, runtimeCategory, status | Skill definitions |

### Session & History Tables

| Table | Key Fields | Purpose |
|---|---|---|
| `AssistantSession` | userId, companyId, currentRoute, currentContextJson, status | Conversation sessions |
| `AssistantMessage` | sessionId, role, content, inputMode | Chat messages |
| `AssistantActionRun` | sessionId, companyId, userId, intentType, targetModule, status, requestPayloadJson, resultPayloadJson | Action execution log |
| `AssistantQuestionLog` | companyId, userId, question, assistantType, groundingStatus | Question audit trail |
