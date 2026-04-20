# 02 — Tech Stack

## Core Technologies

| Layer | Technology | Version | Why Chosen |
|-------|-----------|---------|------------|
| **Frontend Framework** | Next.js (App Router) | 16.1.6 | Full-stack React framework with SSR, API routes, file-based routing |
| **UI Library** | React | 19.2.3 | Industry standard, massive ecosystem, latest concurrent features |
| **Language** | TypeScript | 5.x | Type safety across full stack, better DX, fewer runtime errors |
| **Styling** | Vanilla CSS | — | Maximum control, no build tool dependency, custom design system |
| **Icons** | Lucide React | 0.577.0 | Consistent, tree-shakeable, MIT licensed icon set |
| **Charts** | Recharts | 3.7.0 | React-native charting, declarative API, responsive |
| **Drag & Drop** | dnd-kit | 6.x / 10.x | Modern, accessible DnD for Kanban boards |
| **Markdown** | react-markdown | 10.1.0 | Render AI chat responses with formatting |

## Backend & Data

| Layer | Technology | Version | Why Chosen |
|-------|-----------|---------|------------|
| **API Layer** | Next.js API Routes | 16.1.6 | Co-located with frontend, serverless deployment, no separate server |
| **ORM** | Prisma | 7.4.2 | Type-safe DB access, migrations, schema-first design |
| **Database** | PostgreSQL (Supabase) | 15+ | Relational integrity, pgvector for embeddings, managed hosting |
| **Vector Search** | pgvector | — | Embedding storage on same DB (no separate vector DB needed) |
| **Validation** | Zod | 4.3.6 | Runtime validation, TypeScript inference, composable schemas |
| **Data Access (Admin)** | @supabase/supabase-js | 2.98.0 | Service role admin operations, auth admin, storage |

## Authentication & Auth

| Technology | Why Chosen |
|-----------|------------|
| **Supabase Auth** | Managed auth with JWT, email/password + Google OAuth, row-level security |
| **@supabase/ssr** | Cookie-based session management for Next.js SSR/API routes |
| **Google OAuth** | Social login integration via Supabase |

## AI & ML

| Technology | Model/Version | Purpose |
|-----------|---------------|---------|
| **OpenAI GPT-4o** | gpt-4o | Primary LLM for complex generation tasks |
| **OpenAI GPT-4o-mini** | gpt-4o-mini | Cost-effective LLM for simpler tasks |
| **OpenAI Embeddings** | text-embedding-3-small | 1536-dim vectors for document chunking and RAG |
| **OpenAI Whisper** | whisper-1 | Voice-to-text transcription |
| **openai SDK** | 6.25.0 | Unified API client for all OpenAI services |

## Document Processing

| Technology | Purpose |
|-----------|---------|
| **pdf-parse** (2.4.5) | Extract text from PDF files |
| **mammoth** (1.11.0) | Extract text from DOCX files |
| **Native** | Plain text, Markdown, CSV read via Node.js |

## File Storage

| Technology | Purpose |
|-----------|---------|
| **Supabase Storage** | Managed S3-compatible file storage for uploaded documents |

## Testing

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Playwright** | 1.58.2 | End-to-end browser testing |
| **ESLint** | 9.x | Code linting and style enforcement |

## Infrastructure

| Component | Technology |
|-----------|-----------|
| **Hosting** | Vercel (serverless) or self-hosted VM |
| **Database Hosting** | Supabase Cloud (managed PostgreSQL) |
| **CDN** | Vercel Edge Network (when on Vercel) |
| **DNS** | External provider |
| **CI/CD** | Git-based deploy (Vercel auto-deploy or manual) |

## Known Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| **No external state management** | Simple but can lead to prop drilling in complex pages |
| **Vanilla CSS over Tailwind** | Full control but more verbose; requires strict convention |
| **No background job queue** | Simple deployment but all processing is synchronous (blocks HTTP requests) |
| **Supabase JS for some queries** | Two data access patterns (Prisma + Supabase client) can confuse |
| **pgvector over dedicated vector DB** | Lower cost, simpler infra, but may not scale for millions of embeddings |
| **Monolithic Next.js** | Simple deployment, shared types, but no microservice boundaries |
| **Client-side rendering for dashboard** | Fast interactivity but no SEO on authenticated pages |
| **No caching layer** | Simple but every request hits the database; may need Redis later |
