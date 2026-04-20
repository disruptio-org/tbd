# 06 — RAG & Knowledge Pipeline

## Overview

Nousio's knowledge pipeline transforms uploaded documents into searchable vector embeddings and retrieves relevant context for every AI interaction. This is the core mechanism that grounds AI responses in company-specific knowledge.

## Pipeline Stages

```
Document Upload → Text Extraction → Chunking → Embedding → Storage
                                                              │
User Query → Query Embedding → Similarity Search → Ranking → Context Injection
```

## 1. Ingestion Sources

| Source | Method |
|--------|--------|
| File upload (UI) | Manual upload via Documents page or Setup wizard |
| Google Drive sync | OAuth-based folder sync via `DocumentSourceAdapter` |
| Notion sync | Internal Integration Token → auto-discovers shared pages |
| Web scraping | Company website context via Backoffice scraper |
| Manual text | Company profile fields (description, products, etc.) |

### Supported File Formats
PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, CSV, TXT, MD, PNG, JPG, JPEG

### External Document Sync Pipeline
```
CompanyIntegration (tokens + config)
  → DocumentSourceAdapter.listFolders()
  → DocumentSourceAdapter.listFiles(folderId)
  → downloadFile() → extractTextFromBuffer() → embedDocument()
  → ExternalDocument (with content hash for incremental sync)
```

**Key tables**: `CompanyIntegration` (provider config), `ExternalDocument` (synced files), `DocumentEmbedding` (vectors)

**Sync modes**: Manual (UI "Sync Now"), scheduled (1h/6h/12h/24h), auto-discovery (Notion)

## 2. File Parsing / Text Extraction

| Format | Library | Notes |
|--------|---------|-------|
| PDF | `pdfjs-dist` (legacy build) | Extracts full text from all pages |
| DOCX | `mammoth` (v1.11.0) | Converts to text, strips formatting |
| Plain text / Markdown | Native `Buffer.toString()` | Direct text read |
| Notion pages | `notion-to-md` + Blocks API fallback | Converts Notion blocks to Markdown |
| Google Docs | Exported as DOCX via Drive API | Then processed via mammoth |
| Images | OCR API (when enabled) | Optional image-to-text |
| Excel / PowerPoint | Limited | Basic text extraction |

## 3. Chunking

**Location**: `src/lib/embeddings.ts` → `chunkText()`

| Parameter | Value | Description |
|-----------|-------|-------------|
| `CHUNK_SIZE` | 500 | ~500 words per chunk |
| `CHUNK_OVERLAP` | 50 | 50-word overlap between consecutive chunks |

**Algorithm**:
1. Clean text (collapse whitespace)
2. Split by words
3. Create overlapping windows of `CHUNK_SIZE` words
4. Each window is one chunk

## 4. Embedding Generation

**Location**: `src/lib/embeddings.ts` → `generateEmbeddings()`

| Setting | Value |
|---------|-------|
| Model | `text-embedding-3-small` |
| Dimensions | 1536 |
| Batch size | All chunks sent in one API call |

## 5. Vector Storage

**Table**: `DocumentEmbedding`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `companyId` | String | Tenant isolation |
| `documentId` | String | Source `Document` reference (for uploads) |
| `externalDocumentId` | String | Source `ExternalDocument` reference (for Drive/Notion) |
| `chunkIndex` | Int | Sequential position in document |
| `chunkText` | Text | The actual text content |
| `embedding` | Text (JSON) | 1536-dim vector stored as JSON string |

**Notes**:
- Embeddings are stored as JSON text in Prisma, but the actual column uses pgvector (created via raw migration)
- On document re-processing, all existing embeddings are **deleted and regenerated**
- Indexed by `companyId`, `documentId`, and `externalDocumentId`
- A sentinel document (`__external_sentinel__`) serves as FK reference for external document embeddings; hidden from UI

## 6. Metadata Strategy

Each document has metadata that influences retrieval ranking:

| Field | Effect on Retrieval |
|-------|-------------------|
| `useAsKnowledgeSource` | +0.15 score boost (curated content) |
| `knowledgePriority` | `critical`: +0.10, `preferred`: +0.05, `normal`: none |
| `knowledgeCategory` | Included in source citation text |
| `updatedAt` | Recency boost: +0.03 if updated within 30 days |

## 7. Retrieval Logic

**Location**: `src/lib/rag-retrieval.ts` → `retrieveRelevantKnowledge()`

### 5-Stage Pipeline

**Stage 1: Query Embedding**
- User's input query → OpenAI embedding → 1536-dim vector

**Stage 2: Candidate Scoring**
- Fetch ALL `DocumentEmbedding` records for the company
- Compute cosine similarity between query vector and each chunk vector
- Filter by minimum threshold (0.20)
- Take top 20 candidates

**Stage 3: Metadata Enrichment**
- Load document metadata for all candidate documents
- Apply composite scoring:
  - Knowledge source boost: +0.15
  - Priority boost: +0.10 (critical) / +0.05 (preferred)
  - Recency boost: +0.03 (updated within 30 days)
  - Short chunk penalty: -0.10 (if < 50 chars)

**Stage 4: Composite Ranking**
- Sort by `finalScore` (similarity + boosts)

**Stage 5: Diversity + Dedup + Cap**
- Max 8 chunks total (`maxChunks`)
- Max 3 chunks per document (`maxChunksPerDoc`)
- Skip chunks < 30 chars
- Skip near-duplicates (first 80 chars match)

### Configuration (RAGOptions)

| Option | Default | Description |
|--------|---------|-------------|
| `maxChunks` | 8 | Maximum chunks to return |
| `minSimilarity` | 0.20 | Minimum cosine similarity threshold |
| `maxChunksPerDoc` | 3 | Maximum chunks from one document |

## 8. Context Formatting

**Location**: `src/lib/rag-retrieval.ts` → `formatRAGContext()`

Retrieved chunks are formatted into a structured text block:

```
=== COMPANY KNOWLEDGE BASE (automatically retrieved relevant information) ===
[Knowledge Source 1 — document.pdf (category)]
<chunk text>

---

[Knowledge Source 2 — another.docx]
<chunk text>
=== END COMPANY KNOWLEDGE BASE ===
```

This is injected directly into the system prompt for the LLM.

## 9. Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| All embeddings fetched in memory | O(n) scaling — slow with many documents | Future: use pgvector native similarity search |
| No incremental indexing | Full re-embed on document update | Acceptable for current scale |
| Fixed chunk size | May split important context | Overlap helps; semantic chunking is future work |
| JSON-stored vectors | Less efficient than native pgvector queries | Migration to native vector column planned |
| No cross-company search | By design (tenant isolation) | N/A |
| No reranking model | Uses cosine similarity + heuristics only | Future: cross-encoder reranking |

## 10. Freshness/Update Strategy

- Documents can be re-uploaded (same filename → new embeddings)
- **External documents**: Incremental sync via content hash — only re-embeds when content changes
- **Google Drive**: Sync frequency configurable (1h/6h/12h/24h/manual)
- **Notion**: Sync triggered manually; auto-discovers new pages on each sync
- Manual re-embedding available via document page

## 11. Documents UI

The Documents page provides a unified view with source-based tabs:

| Tab | Source | Features |
|-----|--------|----------|
| All Sources | Combined | Shows all documents from all sources |
| Uploads | `Document` table | Manual file uploads, folder organization |
| Google Drive | `ExternalDocument` (provider: GOOGLE_DRIVE) | Synced Drive files with Drive logo |
| Notion | `ExternalDocument` (provider: NOTION) | Synced Notion pages with Notion logo |

Document viewer supports:
- PDF/Image preview via iframe
- Markdown rendering (ReactMarkdown) for text/markdown files
- Extracted text display for DOCX and other formats
- Document chat (ask questions about the document via GPT)
