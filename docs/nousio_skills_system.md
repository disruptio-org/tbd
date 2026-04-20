# Nousio Skills System — Technical Documentation

> **Last updated:** 2026-04-14
> **Author:** Nousio Platform Team

---

## 1. Overview

The **Skills System** is Nousio's modular content-generation engine. Each **Skill** is a re‑usable AI "program" — a structured instruction prompt — that tells the AI how to produce a specific type of output (e.g. a LinkedIn post, a PRD, a competitive analysis).

Skills are the atomic unit of work inside Nousio. When a user selects a skill and provides input (a topic, audience, tone), the platform combines:

1. The skill's **instruction prompt** (the "program")
2. The company's **contextual data** (profile, products, RAG knowledge)
3. The user's **parameters** (topic, audience, tone, language, length)

…and sends them to OpenAI as a single, structured request.

### Key Principles

- **Skills are company-scoped** — each company has its own skill library.
- **Skills are assignable** — a skill can be attached to one or more AI Team Members.
- **Skills are versionable** — every instruction prompt change is logged.
- **Skills are importable** — from `.md` files, `.zip` packages, or GitHub repos.
- **Skills can be chained** — multi-step workflows where one skill's output feeds the next.
- **Skills can be scheduled** — automated execution via cron triggers.

---

## 2. Data Model

### 2.1 AssistantSkill (Primary Table)

The core table for all skills in the system.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `companyId` | UUID | FK → Company |
| `key` | String | Unique slug: `linkedin_post`, `prd`, `competitive_analysis` |
| `name` | String | Display name: "LinkedIn Post" |
| `description` | Text | Optional description |
| `icon` | String | Lucide icon name: `"briefcase"`, `"pen-line"` |
| `category` | String | Optional grouping: `"social_media"`, `"documentation"` |
| `status` | String | `ACTIVE` / `DRAFT` / `ARCHIVED` |
| `executionType` | String | `NATIVE` (default) / `ZAPIER_MCP` / `N8N_WORKFLOW` / `WEBHOOK` |
| `executionConfig` | JSON | External execution config (MCP endpoint, webhook URL, etc.) |
| `instructionPrompt` | Text | **The core AI instructions** — the skill's "program" |
| `outputSchema` | JSON | Structured output field definitions |
| `requiredInputs` | JSON | What the user must provide (metadata) |
| `defaultParams` | JSON | Default tone, length, audience, chain config |
| `trainingMaterials` | JSON | Array of `{ id, filename, textContent, uploadedAt }` |
| `enabledActions` | String[] | IDs of `ExternalAction` records for post-generation actions |
| `outputActions` | String[] | UI buttons to show: `preview`, `copy`, `regenerate`, `render_ui`, `export_zip`, `export_md`, `export_pdf` |
| `sortOrder` | Int | Display ordering |
| `isDefault` | Boolean | `true` = system-provided, `false` = user-created |
| `version` | Int | Auto-incremented on each instruction prompt change |
| `importMode` | String | `LEGACY` / `PRESERVED` / `COMPATIBLE` / `DEGRADED` — how the skill was imported |
| `runtimeCategory` | String | `content-generation` / `tool-orchestrated` / `artifact-generation` / `ui-rendering` / `connector-workflow` / `hybrid` |
| `responseMode` | String | `chat` / `artifact_first` / `artifact_plus_chat` / `ui_rendered` / `action_result` / `multi_output` |
| `requiredCapabilities` | String[] | Capability tags: `slide_generation`, `image_generation`, `browsing`, etc. |
| `requiredConnectors` | String[] | IDs or slugs of required `ExternalAction` / Integration records |
| `artifactContracts` | JSON | Expected artifact outputs: `[{ type, mimeType, description }]` |
| `uiContracts` | JSON | Expected UI behaviors: `[{ intent, params }]` |
| `compatibilityState` | String | `FULLY_COMPATIBLE` / `COMPATIBLE_DEGRADED` / `INCOMPATIBLE` / `UNKNOWN` |
| `degradationNotes` | Text | What was lost during import/adaptation |
| `rawPackageRef` | String | Storage path to original imported `.zip`/`.md` |
| `parsedManifest` | JSON | Full parsed manifest from import analysis |

**Unique constraint:** `(companyId, key)` — no two skills can share the same key within a company.

**Relationships:** `SkillAssignment[]`, `BrainProfileSkill[]`, `SkillArtifact[]`

### 2.2 SkillAssignment (Many-to-Many: Skill ↔ Team Member)

Links a skill to one or more AI Team Member types.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `skillId` | UUID | FK → AssistantSkill |
| `assistantType` | String | `MARKETING` / `SALES` / `PRODUCT_ASSISTANT` / `ONBOARDING` / `COMPANY_ADVISOR` / `GENERAL_AI` |

**Unique constraint:** `(skillId, assistantType)` — prevents duplicate assignments.

### 2.3 BrainProfileSkill (Skill ↔ Brain Profile)

Links a skill to a specific brain profile instance (used in Boardroom for per-member skill selection).

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `brainProfileId` | UUID | FK → AIBrainProfile |
| `skillId` | UUID | FK → AssistantSkill |

### 2.4 SkillArtifact (First-Class Runtime Output)

Stores binary/structured outputs produced during skill execution (presentations, PDFs, images, spreadsheets, zip archives, etc.).

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `companyId` | UUID | FK → Company |
| `skillId` | UUID? | FK → AssistantSkill (optional — may be ad-hoc) |
| `skillRunId` | UUID | ID from `SkillRun` table |
| `chainStepIndex` | Int? | If produced during a chain step |
| `type` | String | `presentation` / `document` / `spreadsheet` / `pdf` / `image` / `zip` / `chart` / `structured_ui` |
| `mimeType` | String | MIME type (e.g. `application/vnd.openxmlformats-officedocument.presentationml.presentation`) |
| `filename` | String | Output filename (e.g. `my_deck.pptx`) |
| `storagePath` | String | Supabase Storage path |
| `sizeBytes` | Int? | File size in bytes |
| `previewUrl` | String? | Generated preview image URL |
| `metadata` | JSON? | Extra artifact-specific metadata |

### 2.5 SkillVersionLog

Append-only version history for instruction prompt changes.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `skillId` | UUID | FK → AssistantSkill |
| `version` | Int | Version number at time of change |
| `instructionPrompt` | Text | The prompt text at that version |
| `changedBy` | UUID | User who made the change |
| `changeSummary` | String | Human-readable description of change |

### 2.6 SkillRating

User feedback per generation.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `companyId` | UUID | FK → Company |
| `skillKey` | String | Links to `AssistantSkill.key` |
| `assistantType` | String | Which assistant context was used |
| `generationRunId` | UUID | Links to the generation run |
| `userId` | UUID | Who rated |
| `rating` | Int | 1 (thumbs down) or 5 (thumbs up) |
| `feedback` | Text? | Optional written feedback |

### 2.7 SkillSchedule (Supabase-native)

Automated execution schedules.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `skillId` | UUID | FK → AssistantSkill |
| `companyId` | UUID | FK → Company |
| `isActive` | Boolean | Whether the schedule is enabled |
| `frequency` | String | `daily` / `weekdays` / `weekly` / `interval` |
| `runAtTime` | String | `"09:00"` — time of day (HH:mm) |
| `timezone` | String | `"Europe/Lisbon"` |
| `daysOfWeek` | Int[] | For weekly: `[1, 3, 5]` = Mon, Wed, Fri |
| `intervalMinutes` | Int | For interval frequency |
| `outputFormat` | String | `executive_summary` or `full` |
| `nextRunAt` | DateTime | Computed next execution time |
| `lastRunAt` | DateTime | Last successful execution |

### 2.8 SkillRun (Supabase-native)

Execution log for each skill run.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `skillId` | UUID | FK → AssistantSkill |
| `scheduleId` | UUID | FK → SkillSchedule (if scheduled) |
| `companyId` | UUID | FK → Company |
| `triggerType` | String | `scheduled` / `manual` / `boardroom` |
| `status` | String | `running` / `success` / `failed` |
| `inputPayload` | JSON | The input parameters |
| `runtimeContext` | JSON | Execution metadata (timezone, window, etc.) |
| `outputTitle` | String | Generated title |
| `outputText` | Text | Generated content |
| `modelUsed` | String | e.g. `"gpt-5.4"` |
| `errorMessage` | String | Error details if failed |
| `startedAt` | DateTime | Execution start |
| `finishedAt` | DateTime | Execution end |

---

## 3. Skill Execution Pipeline

### 3.1 How a Skill Runs

When a user triggers a skill (via an AI Team Member chat), the following pipeline executes:

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  User Input  │────▶│  Skill Resolver  │────▶│  Prompt Assembly   │
│  (topic,     │     │  (load from DB   │     │  (system prompt +  │
│   audience,  │     │   by key + type) │     │   skill instruct + │
│   tone, etc) │     │                  │     │   company context + │
└──────────────┘     └──────────────────┘     │   RAG knowledge)  │
                                               └────────┬───────────┘
                                                        │
                                               ┌────────▼───────────┐
                                               │  OpenAI API Call   │
                                               │  (gpt-5.4, JSON   │
                                               │   structured out)  │
                                               └────────┬───────────┘
                                                        │
                                               ┌────────▼───────────┐
                                               │  Output Storage    │
                                               │  (GenerationRun    │
                                               │   table + display) │
                                               └────────────────────┘
```

### 3.2 Prompt Assembly

The generation engine (`src/lib/assistant-generate.ts`) builds the final prompt in layers:

1. **Base System Role** — The AI Team Member's identity prompt (e.g. "You are an AI Marketing Assistant...")
2. **Skill Instructions** — The `instructionPrompt` from the `AssistantSkill` record, appended as `=== SKILL-SPECIFIC INSTRUCTIONS ===`
3. **Company Context** — Company profile (name, products, value proposition, strategic goals, competitors, etc.)
4. **RAG Context** — Retrieved knowledge from the company's wiki and document embeddings
5. **User Parameters** — Content type, language, tone, audience, goal, length

### 3.3 Dynamic Placeholders

Skills support two kinds of dynamic injection:

#### `$ARGUMENTS` — User Input Substitution

The user's topic text is tokenized and injected into the prompt:

| Placeholder | Resolves to |
|---|---|
| `$ARGUMENTS` | Full topic string |
| `$ARGUMENTS[0]` or `$0` | First word of the topic |
| `$ARGUMENTS[1]` or `$1` | Second word |
| ... | etc. |

**Example:**
```
Create a $ARGUMENTS[0] analysis for the $ARGUMENTS[1] industry.
```
If topic = `competitive SaaS`, resolves to: `Create a competitive analysis for the SaaS industry.`

#### `!{TOKEN}` — Company Data Injection

Real-time company data is resolved at execution time:

| Token | Resolves to |
|---|---|
| `!{COMPANY_PRODUCTS}` | `CompanyProfile.productsServices` |
| `!{COMPANY_OFFERINGS}` | `CompanyProfile.mainOfferings` |
| `!{COMPANY_VALUE_PROP}` | `CompanyProfile.valueProposition` |
| `!{COMPANY_CUSTOMERS}` | `CompanyProfile.targetCustomers` |
| `!{COMPANY_GOALS}` | `CompanyProfile.strategicGoals` |
| `!{COMPANY_INDUSTRIES}` | `CompanyProfile.targetIndustries` |
| `!{COMPANY_COMPETITORS}` | `CompanyProfile.competitors` |
| `!{RECENT_DOCS}` | Last 10 document names from the knowledge base |
| `!{TEAM_NOTES}` | Last 5 generation outputs (for iteration) |

### 3.4 Structured Output

All generation requests use OpenAI's JSON structured output mode. The output schema is:

```json
{
  "title": "string — Generated title",
  "content": "string — Full markdown content",
  "contentStructured": {
    "hook": "string",
    "headline": "string",
    "body": "string",
    "sections": "string"
  },
  "summary": "string — One-line summary"
}
```

### 3.5 Refinement Actions

After generation, users can refine content with:

| Action | Behavior |
|---|---|
| `regenerate` | Completely new version with fresh approach |
| `rewrite` | Improve clarity and impact |
| `shorten` | Condense while keeping key message |
| `expand` | Add more detail, examples, depth |
| `change_tone` | Rewrite in specified tone |

---

## 4. Skill Scheduling

### 4.1 How Scheduled Skills Work

Skills can be configured to run automatically via a **cron-triggered endpoint**.

**Endpoint:** `GET /api/skills/scheduler?secret=<CRON_SECRET>`

The scheduler is designed to be triggered by **Vercel Cron** at regular intervals (e.g. every 15 minutes). On each trigger it:

1. Queries `SkillSchedule` for schedules where `isActive = true` AND `nextRunAt <= now()`
2. For each due schedule:
   - Performs an **idempotency check** (skip if already ran today)
   - Creates a `SkillRun` record with status `running`
   - Builds a system prompt using the skill's `instructionPrompt` + runtime context
   - Calls OpenAI with web search enabled
   - Updates the `SkillRun` with the output (or error)
   - Computes and stores the next `nextRunAt` based on frequency

### 4.2 Frequency Options

| Frequency | Behavior |
|---|---|
| `daily` | Runs once per day at `runAtTime` |
| `weekdays` | Runs Mon–Fri at `runAtTime` |
| `weekly` | Runs on specified `daysOfWeek` at `runAtTime` |
| `interval` | Runs every `intervalMinutes` minutes |

### 4.3 Output Delivery

Scheduled skill outputs are stored in the `SkillRun` table and surfaced in the **Today Dashboard** as insight cards. Users can view the full output from there.

---

## 5. Skill Chains

### 5.1 What Are Chains?

A **skill chain** is a multi-step workflow where the output of each step feeds into the next step as context. This enables complex workflows like:

```
Research → Draft Article → Copy Review
```

### 5.2 Chain Configuration

Chains are defined in a skill's `defaultParams.chain` as an ordered array of skill keys:

```json
{
  "chain": ["research", "draft_article", "copy_review"]
}
```

### 5.3 Chain Execution

**Endpoint:** `POST /api/ai/skills/chain`

**Request:**
```json
{
  "skillKey": "content_workflow",
  "topic": "AI in healthcare",
  "language": "en"
}
```

The chain executor (`src/lib/community-skills/chain-executor.ts`):

1. Loads the chain definition from the trigger skill's `defaultParams`
2. For each step in the chain:
   - Loads the step skill's `instructionPrompt`
   - Prepends the previous step's output as context
   - Calls OpenAI
   - Records the step result
3. Returns the final combined output

**Response:**
```json
{
  "chainId": "uuid",
  "status": "completed",
  "steps": [
    { "skillKey": "research", "status": "completed", "output": "...", "durationMs": 3200 },
    { "skillKey": "draft_article", "status": "completed", "output": "...", "durationMs": 5100 },
    { "skillKey": "copy_review", "status": "completed", "output": "...", "durationMs": 2800 }
  ],
  "finalOutput": "...",
  "totalDurationMs": 11100
}
```

---

## 6. AI-Powered Training

### 6.1 How Training Works

Skills can be improved by uploading **training materials** — documents, transcripts, best-practice guides — that the AI uses to enhance the instruction prompt.

**Endpoint:** `POST /api/ai/skills/[id]/train`

### 6.2 Training Flow

1. Admin uploads training materials (stored in `AssistantSkill.trainingMaterials` as JSON)
2. Admin triggers training
3. The training endpoint:
   - Loads the current `instructionPrompt`
   - Loads all `trainingMaterials` text content
   - Sends both to GPT-4o with a meta-prompt: *"Improve this instruction prompt by absorbing knowledge from the training materials"*
   - Returns the improved prompt as a **suggestion** (not auto-applied)
4. Admin reviews and accepts/rejects the improved prompt
5. If accepted, the prompt is saved (version is incremented, old version is logged)

### 6.3 Training Material Format

Each material is stored as:
```json
{
  "id": "uuid",
  "filename": "sales_playbook.md",
  "textContent": "... content up to 50,000 chars ...",
  "uploadedAt": "2026-04-10T12:00:00Z"
}
```

---

## 7. Importing Skills

Nousio supports three import methods:

### 7.1 Manual Creation (API)

**Endpoint:** `POST /api/ai/skills`

Admin provides `key`, `name`, `instructionPrompt`, and optional fields. The skill is created directly.

### 7.2 File Import (.md or .zip)

**Endpoint:** `POST /api/ai/skills/import`

#### Raw `.md` File

Upload a single markdown file with optional YAML frontmatter:

```markdown
---
name: competitor-analysis
description: Deep competitive analysis framework
category: strategy
---

You are an expert competitive analyst. When given a company and its competitors...

[... instruction prompt ...]
```

The frontmatter provides metadata; the body becomes the `instructionPrompt`.

#### `.zip` Package

A structured archive containing:

```
my-skill/
├── SKILL.md           # Required — instruction prompt with frontmatter
├── agents/
│   └── agent.yaml     # Optional — display metadata (name, description, category)
├── references/
│   └── guide.md       # Optional — stored as training materials
├── scripts/
│   └── helper.ts      # Optional — stored as training materials
├── examples/
│   └── sample.md      # Optional — stored as training materials
└── resources/
    └── data.json      # Optional — stored as training materials
```

**Processing:**
1. Locates `SKILL.md` anywhere in the zip
2. Parses frontmatter for metadata
3. Reads `agents/*.yaml` for display info
4. Collects all files from `references/`, `scripts/`, `examples/`, `resources/` as training materials
5. Supports **preview mode** (validate before import) and **import mode** (create immediately)

#### Auto-Adaptation

When `autoAdapt = true` (default), the import process uses GPT to **rewrite** the raw instructions for Nousio's pipeline. This handles skills originally written for other AI coding agents (Claude Code, Cursor, etc.) that reference tools, file systems, and terminals that don't exist in Nousio.

The adaptation:
- **Preserves** domain expertise and quality standards
- **Removes** references to terminals, file systems, browser automation, npm, git
- **Removes** model-specific syntax (Claude artifacts, MCP references)
- **Reframes** for content generation context
- **Adds** Nousio-specific instructions (company context, audience, structured output)

The original raw instructions are preserved as a training material for reference.

### 7.3 GitHub URL Import

**Endpoint:** `POST /api/ai/skills/import-url`

Import skills directly from a public GitHub repository.

#### List Available Skills

```json
POST /api/ai/skills/import-url
{
  "repoUrl": "https://github.com/org/skill-library",
  "mode": "list"
}
```

Response:
```json
{
  "skills": ["linkedin-post", "competitive-analysis", "prd-generator"],
  "repo": "org/skill-library"
}
```

The system searches for skills in standard conventions: `.skills/`, `skills/`, or root-level directories containing a `SKILL.md`.

#### Preview a Skill

```json
POST /api/ai/skills/import-url
{
  "repoUrl": "https://github.com/org/skill-library",
  "skillName": "linkedin-post",
  "mode": "preview"
}
```

Returns the parsed skill metadata, instruction prompt, and supporting file list without creating anything.

#### Import a Skill

```json
POST /api/ai/skills/import-url
{
  "repoUrl": "https://github.com/org/skill-library",
  "skillName": "linkedin-post",
  "assistantTypes": ["MARKETING"],
  "autoAdapt": true,
  "mode": "import"
}
```

The importer:
1. Parses the GitHub URL into `owner/repo`
2. Searches for the skill in standard folder conventions
3. Fetches `SKILL.md` and all supporting files from `scripts/`, `examples/`, `resources/`, `references/`
4. Optionally auto-adapts the instructions for Nousio
5. Creates the `AssistantSkill`, `SkillAssignment`, and `SkillVersionLog` records
6. Returns the created skill with metadata

**GitHub Authentication:** If a `GITHUB_TOKEN` environment variable is set, it's used for API requests (useful for private repos or avoiding rate limits).

---

## 8. Skill Management (CRUD)

### 8.1 List Skills

```
GET /api/ai/skills?assistantType=MARKETING&includeArchived=true
```

Returns all skills for the current company, optionally filtered by assistant type via `SkillAssignment` join.

### 8.2 Get Single Skill

```
GET /api/ai/skills/[id]
```

Returns the full skill record with its `assistantTypes` array.

### 8.3 Update Skill

```
PATCH /api/ai/skills/[id]
{
  "name": "Updated Name",
  "instructionPrompt": "New instructions...",
  "assistantTypes": ["MARKETING", "SALES"]
}
```

When `instructionPrompt` changes:
- Version is auto-incremented
- Previous version is saved to `SkillVersionLog`

When `assistantTypes` changes:
- Removed assignments are deleted
- New assignments are inserted
- The diff is computed automatically

### 8.4 Delete Skill

```
DELETE /api/ai/skills/[id]
```

- **Custom skills** (`isDefault = false`): Hard-deleted
- **System skills** (`isDefault = true`): Archived (status → `ARCHIVED`)

---

## 9. Skill Testing, Analytics & Versions

### 9.1 Skill Test Execution

**Endpoint:** `POST /api/ai/skills/test`

Lightweight sandbox for testing a skill's instruction prompt without creating conversations or messages. Supports multipart/form-data for file attachments (images, text files).

**Request (multipart/form-data):**

| Field | Type | Description |
|---|---|---|
| `instructionPrompt` | String | The skill instructions to test |
| `trainingMaterials` | JSON string | `[{ filename, textContent }]` |
| `testMessage` | String | **Required** — The test input/topic |
| `files` | File[] | Optional attached files (images sent as vision, text read inline) |

**Behavior:**
- Images (`png`, `jpeg`, `gif`, `webp`) are converted to base64 and sent via OpenAI's vision API
- Text files are read and appended to the user message
- Output format hint instructs the model to produce clean HTML (not JSX) for UI-rendering skills
- Uses `gpt-5.4-mini` for cost efficiency
- **Admin-only** — requires `role = ADMIN`

### 9.2 Skill Analytics

**Endpoint:** `GET /api/ai/skills/analytics?assistantType=MARKETING`

Returns per-skill aggregated rating analytics for the current company.

**Response:**
```json
{
  "analytics": [
    {
      "skillKey": "linkedin_post",
      "assistantType": "MARKETING",
      "totalRatings": 42,
      "thumbsUp": 38,
      "thumbsDown": 4,
      "avgRating": 90,
      "recentRatings": [
        { "rating": 5, "createdAt": "2026-04-14T10:00:00Z" }
      ]
    }
  ]
}
```

- `avgRating` is a percentage (thumbs up / total × 100)
- `recentRatings` includes the last 5 ratings per skill
- Results capped at 500 most recent ratings

### 9.3 Version History

**Endpoint:** `GET /api/ai/skills/versions?skillId=xxx`

Returns up to 20 most recent version log entries for a skill, ordered by version descending.

**Response:**
```json
{
  "versions": [
    {
      "id": "uuid",
      "version": 3,
      "instructionPrompt": "...",
      "changedBy": "user-uuid",
      "changeSummary": "Added competitor analysis section",
      "createdAt": "2026-04-14T10:00:00Z"
    }
  ]
}
```

---

## 10. UI Integration

### 10.1 Client-Side Hook

The `useAssistantSkills(assistantType)` hook (`src/lib/useAssistantSkills.ts`) fetches skills from the API and converts them into `ContentType[]` objects for the `AIAssistantChat` component.

Each skill becomes a selectable option in the team member's chat interface — the user picks a skill, provides a topic, and the generation runs.

### 10.2 Skills Manager Panel

The Skills Manager is accessible from **Settings → AI Brain**. It provides:

- **Skill list** with status badges, assignment counts, and sort ordering
- **Instruction prompt editor** with version history
- **Training material uploader** with AI training trigger
- **Skill import** via file upload or GitHub URL
- **Schedule configuration** with timezone-aware scheduling
- **Output action configuration** (which buttons to show: preview, copy, render, export)
- **Skill test sandbox** — test skills with custom inputs and attached files
- **Response mode selector** — configure how the skill delivers output (chat, artifact, UI render, etc.)
- **Runtime metadata** — view import mode, compatibility state, and degradation notes

### 10.3 Boardroom Integration

In the Boardroom, initiative tasks can be executed using specific skills. The system resolves which team member owns a skill and delegates execution accordingly.

---

## 11. External Actions

Skills can have **post-generation external actions** — integrations that run after content is generated. Examples:

- Send via email (SendGrid, Gmail)
- Post to social media
- Save to CRM
- Trigger a webhook

These are configured via the `enabledActions` field, which references `ExternalAction` records.

---

## 12. File Reference

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Data models: `AssistantSkill`, `SkillAssignment`, `SkillRating`, `SkillVersionLog`, `BrainProfileSkill`, `SkillArtifact` |
| `src/lib/assistant-generate.ts` | Core generation pipeline — prompt assembly, OpenAI call, output parsing |
| `src/lib/useAssistantSkills.ts` | Client-side hook for loading skills per assistant type |
| `src/lib/community-skills/adapt-skill.ts` | GPT-powered skill adaptation for import |
| `src/lib/community-skills/chain-executor.ts` | Multi-step skill chain execution |
| `src/app/api/ai/skills/route.ts` | CRUD: List + Create skills |
| `src/app/api/ai/skills/[id]/route.ts` | CRUD: Get + Update + Delete single skill |
| `src/app/api/ai/skills/[id]/train/route.ts` | AI-powered training from uploaded materials |
| `src/app/api/ai/skills/import/route.ts` | File import (.md / .zip) |
| `src/app/api/ai/skills/import-url/route.ts` | GitHub URL import |
| `src/app/api/ai/skills/chain/route.ts` | Chain execution endpoint |
| `src/app/api/ai/skills/rate/route.ts` | User rating submission |
| `src/app/api/ai/skills/analytics/route.ts` | Per-skill rating analytics aggregation |
| `src/app/api/ai/skills/test/route.ts` | Lightweight skill test sandbox (multipart + vision) |
| `src/app/api/ai/skills/versions/route.ts` | Version history retrieval |
| `src/app/api/skills/scheduler/route.ts` | Cron-triggered scheduled execution |

---

## 13. Glossary

| Term | Definition |
|---|---|
| **Skill** | A re-usable AI instruction prompt that produces a specific content type |
| **Instruction Prompt** | The core "program" — the detailed instructions that tell the AI what to produce and how |
| **Skill Key** | A unique lowercase slug (`linkedin_post`) that identifies a skill within a company |
| **Skill Assignment** | A link between a skill and an AI Team Member type (e.g. Marketing) |
| **Skill Artifact** | A first-class binary/structured output (PPTX, PDF, image, zip) produced during execution |
| **Training Material** | A document uploaded to improve a skill's instruction prompt via AI |
| **Skill Chain** | A multi-step workflow where skills run in sequence |
| **Skill Schedule** | An automated execution trigger with frequency, time, and timezone |
| **Skill Run** | A single execution record (input, output, status, timing) |
| **Auto-Adaptation** | AI-powered rewriting of imported skills to work with Nousio's pipeline |
| **External Action** | A post-generation integration (email, webhook, social media post) |
| **Response Mode** | How a skill delivers output — `chat`, `artifact_first`, `ui_rendered`, etc. |
| **Runtime Category** | Classification of skill execution type — `content-generation`, `artifact-generation`, `ui-rendering`, etc. |
| **Import Mode** | How a skill was imported — `LEGACY`, `PRESERVED`, `COMPATIBLE`, `DEGRADED` |
| **Compatibility State** | Whether a skill's full capabilities are supported — `FULLY_COMPATIBLE`, `COMPATIBLE_DEGRADED`, `INCOMPATIBLE` |
