# 05 — AI Architecture

## LLM Providers

| Provider | Models Used | Purpose |
|----------|------------|---------|
| OpenAI | `gpt-4o` | Complex generation (proposals, PRDs, strategic advice) |
| OpenAI | `gpt-4o-mini` | Cost-effective generation (chat Q&A, simple drafts) |
| OpenAI | `text-embedding-3-small` | Document embeddings (1536 dimensions) |
| OpenAI | `whisper-1` | Voice-to-text transcription |

## How AI Works Inside the Product

### 1. Prompt Orchestration Flow

```
User Input
  │
  ├── Load Company Profile (CompanyProfile table)
  ├── Load AI Brain Config (AIBrainProfile → configJson)
  ├── RAG Retrieval (retrieveRelevantKnowledge)
  │
  ▼
System Prompt Assembly:
  1. Base system instruction (per assistant type)
  2. Company context (profile, industry, products)
  3. AI Brain personality instructions (formality, tone, depth)
  4. RAG knowledge chunks (auto-retrieved)
  5. Output format instructions
  │
  ▼
OpenAI Chat Completion
  │
  ▼
Response → Save GenerationRun → Display to User
```

### 2. System Prompts vs Runtime Prompts

| Type | Source | Content |
|------|--------|---------|
| **System Prompt** | Hardcoded per assistant + AI Brain config | Role definition, company context, RAG, output format |
| **User Prompt** | User input (text or transcribed voice) | The actual question or generation request |
| **Assistant Prompt** | Previous messages in conversation | Chat history for context continuity |

### 3. AI Brain Configuration

Each company customizes AI behavior per team member via custom-created `AIBrainProfile` records (no predefined types):

```json
{
  "identity": {
    "formality": "professional",
    "personality": "helpful-analytical",
    "displayName": "Nousio"
  },
  "reasoning": {
    "depth": "thorough",
    "sourcePreference": "company-first",
    "factCheckLevel": "moderate"
  },
  "output": {
    "defaultLength": "medium",
    "defaultFormat": "markdown",
    "includeSourceCitations": true
  }
}
```

### 4. Model Routing Logic

Currently simple rule-based:
- **Chat conversations**: `gpt-4o-mini` (fast, cost-effective for Q&A)
- **Growth assistants** (Marketing, Sales, Product): `gpt-4o` (higher quality for content generation)
- **Brain config can override**: Model selection per assistant type via AI Brain settings
- **Embeddings**: Always `text-embedding-3-small` (1536 dims)
- **Voice**: Always `whisper-1`

> **Future**: Model routing based on prompt complexity, cost budgets, and response quality metrics.

## Retrieval (RAG)

See [RAG & Knowledge Pipeline](06-rag-and-knowledge-pipeline.md) for full details.

Summary: 5-stage pipeline — embed query → fetch company embeddings → cosine similarity → metadata enrichment → diversity-capped selection.

## Context Injection Rules

1. **Company Profile** always injected (basic company context)
2. **RAG chunks** injected when knowledge base has relevant content (similarity > 0.20)
3. **Chat history** included for conversational continuity
4. **Brain instructions** injected when AI Brain is configured
5. **Web context** injected if company has `webContext` from scraping

## Memory Model

- **Short-term**: Conversation message history (stored in `Message` table)
- **No long-term memory**: No cross-conversation learning or user preference tracking
- **Context window**: Managed by including recent messages — no explicit truncation strategy yet

## Hallucination Control

| Strategy | Implementation |
|----------|---------------|
| RAG grounding | AI responses grounded in retrieved company knowledge |
| Source citations | RAG chunks include document filenames for attribution |
| Grounding status | `AssistantQuestionLog.groundingStatus`: `VERIFIED`, `PARTIAL`, `NOT_FOUND`, `GENERAL` |
| Knowledge gap tracking | Ungrounded questions surface as `KnowledgeGap` records |
| Brain config | Configurable `factCheckLevel` and `sourcePreference` |

## Structured Output

- AI responses are generally **markdown text** (free-form)
- **Classifications/Data Extraction** uses structured JSON output via prompt engineering
- No OpenAI function calling or tool use currently
- No JSON mode enforcement (responses parsed as markdown)

## Latency Considerations

- **Embedding generation**: ~200ms per batch of chunks
- **RAG retrieval**: ~500ms (embed query + fetch all embeddings + score in memory)
- **Chat completion**: 2-10s depending on model and prompt length
- **No streaming** in most routes (full response wait); some chat routes support streaming

## Cost Controls

- **Model selection**: `gpt-4o-mini` for simple tasks (10x cheaper than `gpt-4o`)
- **Chunk capping**: Max 8 RAG chunks per request
- **No token budget enforcement**: No max token limits on responses
- **No usage-based billing**: Currently no per-generation cost tracking
- **Future**: Usage metrics table (`UsageMetric`) exists for event tracking

## Fallbacks

- If `OPENAI_API_KEY` is not configured, RAG retrieval silently returns empty
- If embedding generation fails, document upload still succeeds (no embeddings)
- If AI generation fails, user sees error message; no retry mechanism
