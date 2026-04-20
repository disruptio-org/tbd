# 🤖 How the Chat AI Bot and RAG Work in Disruptio

> **RAG** stands for **Retrieval-Augmented Generation**.
> In simple terms, it's a way to make the AI smarter by first **finding** relevant information, and then **using that information** to give a better, more accurate answer.

---

## 📖 The Big Picture — Explained Like You're 5

Imagine you're a student and you have a really smart friend (the AI). You ask your friend a question like _"What are our company's vacation policies?"_.

Now, your smart friend is **very good at talking**, but they don't actually **know** your company. They've never read your company's documents. So, if they just answer from memory, they might make stuff up — and that's bad!

**RAG is the solution.** Before your friend answers, we hand them a **folder with the right pages** from your company's documents. Now they read those pages first, and *then* give you an answer based on real information. That's RAG!

Here's the flow in a nutshell:

```
You ask a question
       ↓
🔍 The system FINDS the best matching document pieces (Retrieval)
       ↓
📄 Those pieces are handed to the AI as context (Augmentation)
       ↓
💬 The AI reads them and writes a smart answer (Generation)
```

---

## 🏗️ The Full Pipeline — Step by Step

The entire system works like a chain, where each step feeds into the next. Let's walk through every step from the moment a document is uploaded to the moment you get an answer in the chat.

---

### Step 1: 📤 Document Upload

When a user uploads a document (PDF, Word, Image, or text file), it gets stored in **Supabase Storage** (our cloud file storage). A record is created in the `Document` database table with information like the filename, file type, and company it belongs to.

**Files supported:** PDF, DOCX, DOC, PNG, JPG, JPEG, TIFF, BMP, TXT, MD

**Where this happens:**
- Frontend: the chat page lets you attach files via the 📎 button
- Backend: `src/app/api/documents/upload/` handles the upload

---

### Step 2: 🔤 Text Extraction (OCR)

Computers can't "read" a PDF or image the way humans do. So the next step is to **extract the text** from the file. This is called **OCR** (Optical Character Recognition).

The system handles different file types differently:

| File Type | How Text is Extracted |
|-----------|----------------------|
| **PDF** (with selectable text) | Uses `pdfjs-dist` library to pull the text directly |
| **PDF** (scanned/images only) | Falls back to **OpenAI GPT-4o Vision** to "read" the images |
| **Word (DOCX)** | Uses the `mammoth` library to extract raw text |
| **Images** (PNG, JPG, etc.) | Uses **OpenAI GPT-4o Vision** — the AI literally looks at the picture and types out what it sees |
| **Plain text** (TXT, MD) | Reads it directly, no processing needed |

Once the text is extracted, it's saved in the `extractedText` field of the `Document` record.

**Where this happens:** `src/app/api/ocr/route.ts`

---

### Step 3: ✂️ Chunking (Splitting Text into Pieces)

A document can be very long — think 50 pages! If we sent the entire document to the AI every time someone asks a question, it would be slow and expensive.

Instead, we **split the text into small pieces called "chunks"**. Each chunk is about **500 words** long, with a **50-word overlap** between consecutive chunks so that context isn't lost at the boundaries.

Think of it like cutting a long ribbon into smaller pieces, but each piece shares a tiny bit with its neighbors:

```
Chunk 1:  [==============================]
Chunk 2:       [==============================]
Chunk 3:            [==============================]
                ↑ overlap
```

**Where this happens:** `src/lib/embeddings.ts` → `chunkText()` function

---

### Step 4: 🧠 Embedding (Turning Text into Numbers)

This is the magical step! Computers don't understand words, but they understand numbers. An **embedding** is a way to convert a piece of text into a **long list of numbers** (a vector with 1,536 dimensions) that captures the **meaning** of the text.

Why is this useful? Because similar meanings → similar numbers. So:
- "vacation policy" → `[0.12, -0.34, 0.55, ...]`
- "holiday rules" → `[0.11, -0.33, 0.54, ...]` ← very similar!
- "quarterly revenue report" → `[0.87, 0.22, -0.91, ...]` ← very different!

We use **OpenAI's `text-embedding-3-small` model** to generate these embeddings.

Each chunk gets its own embedding, and both the chunk text and the embedding are stored in the `DocumentEmbedding` database table.

**Where this happens:** `src/lib/embeddings.ts` → `generateEmbeddings()` and `embedDocument()` functions

---

### Step 5: 💬 User Asks a Question

Now someone opens the chat and types a question. The system supports **three chat modes**:

| Mode | Icon | What It Does |
|------|------|-------------|
| **General Chat** | 🤖 | Searches all company documents and answers based on what it finds |
| **Company Knowledge** | 🏢 | Advanced mode with intent classification, company profile context, and smart ranking |
| **Onboarding Assistant** | 🎓 | Helps new employees learn about the company, customized by their role (Sales, HR, etc.) |

**Where this happens:** `src/app/(dashboard)/chat/page.tsx` (frontend) and `src/app/api/chat/route.ts` (backend)

---

### Step 6: 🔍 Retrieval — Finding the Right Chunks

This is the **R** in RAG. When a question arrives, the system needs to find the most relevant document chunks. Here's how:

#### 6a. The question gets embedded

The user's question is converted into an embedding (a list of numbers) using the same OpenAI model. This way, we can compare the question's meaning to every chunk's meaning.

#### 6b. Cosine similarity calculation

For every stored chunk, the system calculates the **cosine similarity** — a math formula that measures how similar two lists of numbers are. The result is a score from 0 to 1:
- **1.0** = identical meaning
- **0.0** = completely unrelated

```
          Question embedding
                ↕ compare
   Chunk 1 embedding → score: 0.85 ✅ (very relevant!)
   Chunk 2 embedding → score: 0.72 ✅ (relevant)
   Chunk 3 embedding → score: 0.15 ❌ (not relevant)
   Chunk 4 embedding → score: 0.91 ✅ (super relevant!)
   ...
```

#### 6c. For Company Knowledge mode — 4-Stage Retrieval Pipeline

The **Company Knowledge** assistant uses a more sophisticated 4-stage pipeline:

**🔹 Stage 1 — Candidate Retrieval:**
Get the top 20 chunks with a similarity score above 0.20.

**🔹 Stage 2 — Metadata Enrichment:**
For each chunk, look up its source document and attach extra info: knowledge category, priority level, whether it's marked as a "knowledge source", and when it was last updated.

**🔹 Stage 3 — Composite Ranking:**
The final score isn't just similarity — it's boosted by several factors:

| Factor | Boost |
|--------|-------|
| Document category matches the question's intent | +0.15 |
| Document is marked as a curated knowledge source | +0.20 |
| Document has "critical" priority | +0.10 |
| Document has "preferred" priority | +0.05 |
| Document updated in the last 30 days | +0.03 |
| Chunk is very short (< 50 characters) | -0.10 (penalty) |

**🔹 Stage 4 — Final Selection:**
- Maximum **2 chunks per document** (so one doc doesn't dominate)
- Maximum **8 chunks total**
- Duplicate/near-duplicate chunks are removed
- Very short chunks (< 30 characters) are skipped

---

### Step 7: 🏷️ Intent Classification

In **Company Knowledge** mode, the system first classifies what kind of question you're asking, using pattern matching on keywords:

| Detected Intent | Trigger Words (examples) |
|----------------|--------------------------|
| 🏢 Company Overview | "empresa", "quem somos", "missão", "valores" |
| 📦 Product | "produto", "serviço", "oferta", "preço" |
| ⚙️ Process | "processo", "fluxo", "workflow", "como funciona" |
| 📋 Policy | "política", "regulamento", "GDPR", "LGPD" |
| 🎓 Onboarding | "onboarding", "boas-vindas", "welcome" |
| 👥 HR | "RH", "férias", "salário", "benefício" |
| 💰 Finance | "finanças", "fatura", "pagamento", "orçamento" |
| 🌐 General | Everything else |

This intent is used to **boost chunks** from matching document categories (e.g., an HR question boosts chunks from documents categorized as "hr" or "policy").

---

### Step 8: 📋 Context Building

After retrieval, all the selected chunks are assembled into a context block. This is the information the AI will read before answering.

For **Company Knowledge** mode, the context includes:
1. **Company Profile** — detailed info like company name, industry, products, target customers, competitors, strategic goals, brand tone, etc.
2. **Web Context** — information extracted from the company's website
3. **Relevant Document Chunks** — the top-ranked pieces found in Step 6

For **Onboarding** mode, it also includes:
- The **Onboarding Guide** summary (if generated)
- Role-specific context

---

### Step 9: 🧑‍🏫 System Prompt (AI's Instructions)

The AI receives a **system prompt** — a set of instructions that tells it how to behave. Different modes have different prompts:

**Company Knowledge mode instructions include:**
- Prioritize company-specific knowledge
- Use ONLY the retrieved documents
- Never hallucinate or invent data
- If info is missing, say so explicitly
- Reference source documents by name
- Respond in the user's language

**Onboarding mode instructions include:**
- Be welcoming and encouraging
- Use simple language
- Stay grounded in provided documents
- Never invent company facts
- Provide structured answers

---

### Step 10: 🤖 AI Generation

Now the system sends everything to **OpenAI GPT-4o-mini**:

```
┌─ System Prompt (instructions + context with document chunks)
│
├─ Conversation History (previous messages, up to 20)
│
└─ User's Question
         ↓
    GPT-4o-mini thinks...
         ↓
    💬 Generated Answer
```

Key settings:
- **Temperature:** 0.3 (low = more factual, less creative)
- **Max tokens:** 2,048 (limit on answer length)

---

### Step 11: ✅ Grounding Status

For Company Knowledge and Onboarding modes, the system evaluates how well the answer is **grounded** in real documents:

| Status | Meaning | Condition |
|--------|---------|-----------|
| 🟢 **VERIFIED** | The answer is well-supported | Top score ≥ 0.85, or top score ≥ 0.75 with 2+ relevant chunks |
| 🟡 **PARTIAL** | Some relevant info found | Top score ≥ 0.40 |
| 🔴 **NOT_FOUND** | No relevant documents | Top score < 0.40 or no chunks found |

This badge is shown in the chat UI so the user knows how trustworthy the answer is.

---

### Step 12: 📌 Sources & Response

The answer is sent back to the frontend with:
- **The AI's answer text**
- **Source documents** (document name + preview of relevant text)
- **Grounding status** (VERIFIED / PARTIAL / NOT_FOUND)
- **Conversation ID** (for continuing the chat)

In the UI, source documents appear as clickable tags. Clicking a source opens the document in a viewer modal.

---

### Step 13: 💾 Persistence

Everything is saved to the database:
- The **conversation** is created (or updated) in the `Conversation` table
- Both the **user message** and **AI response** are saved in the `Message` table
- An **AssistantQuestionLog** is created for knowledge gap detection (tracking which questions the AI struggles with)

---

## 🔍 Smart Search (Bonus Feature)

Besides the chat, there's a separate **Smart Search** feature that also uses RAG. When you search for documents:

1. Your search query gets embedded
2. Cosine similarity finds the most relevant chunks
3. Results are grouped by document (best score per doc)
4. **AI-generated summaries** — for each result, GPT-4o-mini reads up to 6,000 characters of the full document and writes a summary that specifically addresses your search query
5. Falls back to **text search** (keyword matching) if embeddings aren't available

**Where this happens:** `src/app/api/search/route.ts`

---

## 🗺️ Architecture Diagram

Here's a visual overview of the complete pipeline:

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────────┐  │
│  │ Upload Doc  │    │  Chat Interface  │    │  Smart Search      │  │
│  │  (📎 button) │    │  (3 modes)       │    │  (🔍 search bar)   │  │
│  └──────┬──────┘    └────────┬─────────┘    └─────────┬──────────┘  │
└─────────┼───────────────────┼──────────────────────────┼────────────┘
          │                   │                          │
          ▼                   ▼                          ▼
┌─────────────────┐  ┌────────────────────┐   ┌──────────────────────┐
│  OCR Pipeline   │  │  Chat API          │   │  Search API          │
│                 │  │  /api/chat         │   │  /api/search         │
│  PDF → pdfjs    │  │                    │   │                      │
│  PDF → GPT-4o   │  │  1. Embed question │   │  1. Embed query      │
│  DOCX → mammoth │  │  2. Find chunks    │   │  2. Find chunks      │
│  Image → GPT-4o │  │  3. Rank & filter  │   │  3. Group by doc     │
│                 │  │  4. Build context   │   │  4. AI summaries     │
└────────┬────────┘  │  5. Ask GPT-4o-mini│   └──────────────────────┘
         │           │  6. Return answer   │
         ▼           └────────────────────┘
┌─────────────────┐
│  Embedding      │
│  Pipeline       │
│                 │
│  Text → Chunks  │
│  Chunks → Embed │
│  Store in DB    │
└────────┬────────┘
         │
         ▼
┌───────────────────────────────────────┐
│          DATABASE (Supabase)          │
│                                       │
│  📄 Document        - file metadata   │
│  🧩 DocumentEmbedding - chunks + vectors │
│  💬 Conversation    - chat threads    │
│  📝 Message         - chat messages   │
│  🏢 CompanyProfile  - company context │
│  🎓 OnboardingGuide - onboarding data │
│  📊 QuestionLog     - gap detection   │
└───────────────────────────────────────┘
```

---

## 📊 Key Models & Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| AI Chat Model | OpenAI GPT-4o-mini | Generates conversational answers |
| Embedding Model | OpenAI text-embedding-3-small | Converts text to 1,536-dimension vectors |
| OCR (Images/PDFs) | OpenAI GPT-4o Vision | Reads text from images and scanned PDFs |
| PDF Parsing | pdfjs-dist | Extracts text from digital PDFs |
| Word Parsing | mammoth | Extracts text from DOCX files |
| Database | Supabase (PostgreSQL) | Stores documents, embeddings, conversations |
| File Storage | Supabase Storage | Stores uploaded document files |
| Frontend | Next.js + React | Chat UI with 3 modes and conversation history |

---

## 🧩 Key Database Tables

| Table | What It Stores |
|-------|---------------|
| `Document` | Uploaded files — name, type, extracted text, knowledge category, priority |
| `DocumentEmbedding` | Text chunks and their embeddings (vectors). Each chunk has ~500 words |
| `Conversation` | Chat threads — which user, which company, which AI mode |
| `Message` | Individual messages in a conversation (user questions + AI answers) |
| `CompanyProfile` | Rich company info (products, customers, processes, competitors, etc.) |
| `CompanyOnboardingGuide` | AI-generated onboarding summary for new employees |
| `AssistantQuestionLog` | Logs every question and its grounding status for gap detection |
| `KnowledgeGap` | Tracks topics where the AI consistently can't find answers |

---

## 🔑 Key Concepts Glossary

| Term | Simple Explanation |
|------|-------------------|
| **RAG** | Retrieval-Augmented Generation — find info first, then answer |
| **Embedding** | A list of numbers that captures the meaning of a text |
| **Cosine Similarity** | A way to measure how similar two embeddings are (0 = different, 1 = same) |
| **Chunk** | A small piece of a document (~500 words) |
| **Grounding** | How well the AI's answer is supported by real documents |
| **Intent Classification** | Figuring out what kind of question the user is asking |
| **OCR** | Optical Character Recognition — reading text from images |
| **System Prompt** | Hidden instructions that tell the AI how to behave |
| **Token** | A "word piece" — roughly ¾ of a word on average |
| **Temperature** | Controls AI creativity: 0 = very strict/factual, 1 = very creative |

---

## ✨ Summary

The Disruptio Chat AI works by:

1. **Uploading** documents → extracting text (OCR)
2. **Splitting** that text into chunks → creating embeddings
3. When a user **asks a question** → embedding the question
4. **Finding** the most relevant chunks using vector similarity
5. **Ranking** those chunks using metadata boosts
6. **Building context** with the best chunks + company profile
7. **Sending everything** to GPT-4o-mini → getting a grounded answer
8. **Showing** the answer with source references and grounding status

It's like giving the AI a **super-focused cheat sheet** every time it answers — so it always talks about *your* company, not random stuff from the internet! 🎯
