# Disruptio — Solution Overview

## 1. Executive Summary

Disruptio is an **AI-powered Enterprise Assistant platform** designed to supercharge growth, knowledge sharing, and onboarding within companies. It acts as a central **"Company Brain"**, aggregating internal documents and company profiles, and exposing that knowledge through specialized AI Assistants (General Chat, Company Advisor, Onboarding, Marketing, Sales, and Product).

The architecture is multi-tenant, cloud-native, and heavily reliant on a **Retrieval-Augmented Generation (RAG)** pipeline to ensure all AI outputs are strictly grounded in the company's actual data.

## 2. Platform Architecture

The system is built on a modern, serverless stack:

- **Frontend & API Layout**: Built with **Next.js 16 (React 19, TypeScript)** using the App Router. Provides a highly responsive, ChatGPT-style interface with fixed positioning and immersive scroll-less layouts.
- **Relational Data**: Powered by **PostgreSQL (Supabase)** and accessed via **Prisma ORM**.
- **File Storage**: **Supabase Storage** holds all uploaded documents (PDFs, Word docs, Images).
- **AI & NLP Engine**: Uses **OpenAI** heavily:
  - `gpt-4o-mini`: Chat, rewrites, fast inferences, RAG generation, OCR fallback.
  - `gpt-4o`: Complex image OCR and high-fidelity text generation.
  - `text-embedding-3-small`: Vectorization of documents for semantic search.
- **Authentication**: **Supabase Auth** (Email/Password & Google OAuth) with automatic user and company provisioning.

## 3. Core Mechanisms

### 3.1 Multi-Tenant Isolation
Every piece of data (users, documents, embeddings, chats, generations) is tied to a `companyId`. Queries and storage access are strictly filtered at the application logic layer to ensure absolute data privacy between organizations.

### 3.2 The Knowledge Pipeline (RAG)
1. **Ingestion & Extraction**: Uploaded documents automatically undergo Optical Character Recognition (OCR) depending on their MIME type (e.g., PDF parsing, Vision APIs for images).
2. **Chunking & Vectorization**: Extracted text is broken into smaller chunks and converted into high-dimensional vectors (embeddings) using `text-embedding-3-small`, then stored in PostgreSQL alongside the original text.
3. **Retrieval**: When a user asks a question, their query is converted to a vector. A cosine similarity search finds the most relevant document chunks.
4. **Ranking & Enrichment**: Chunks are scored based on semantic similarity, recency, document priority ("Curated Sources"), and the user's intent.
5. **Generation & Grounding**: The top chunks are injected into the GPT context window. The system explicitly evaluates the "Grounding Status" (VERIFIED, PARTIAL, NOT FOUND) to visually inform the user if the AI's answer comes strictly from documents or general knowledge.

## 4. The AI Assistants Ecosystem

Instead of a single chatbot, Disruptio exposes its RAG engine through specialized interfaces:

- **Company Advisor**: An internal query engine optimized for HR, Finance, and Process questions, leveraging the structured `CompanyProfile` and the raw documents.
- **Onboarding Assistant**: A role-aware guide for new hires. It dynamically generates an "Onboarding Guide" and adjusts its tone and recommended documents based on whether the user is in Sales, HR, Engineering, etc.
- **Marketing, Sales, & Product Assistants**: Dedicated "Growth" execution spaces. Instead of generic chat, users generate specific formats (e.g., LinkedIn Posts, PRDs, Prospecting Emails). The AI automatically searches the company brain behind the scenes to enrich these outputs with real product features and company tone.
- **Lead Discovery**: Generates targeted B2B leads via AI, matching them against the company's ideal customer profile and suggesting outreach strategies.

## 5. UI/UX Paradigm

The platform prioritizes an immersive, focused user experience modeled after industry-leading AI tools:
- **Clean Focus**: Removal of unnecessary visual noise. Sidebar navigation groups complex modules into clean, collapsible categories.
- **ChatGPT-Style Layout**: Specialized assistant pages (Marketing, Sales, Product) utilize an edge-to-edge layout where the header and input toolbar remain fixed to the viewport, while the main content area streams generations seamlessly above it.
- **Micro-Interactions**: Features a dynamic grid of content types, inline Markdown editing, one-click copy/discard actions, and floating "Grounding Badges" (🟢 Verified, 🟡 Partial) to build trust in the AI's outputs.

## 6. Security and Governance
- **Role-Based Access Control (RBAC)**: Supports roles (`MEMBER`, `ADMIN`, `SUPER_ADMIN`) ensuring that only authorized users can delete knowledge or modify company settings.
- **Knowledge Gaps**: A background process analyzes failed queries ("NOT FOUND") and automatically clusters them to suggest to Admins what new documentation needs to be uploaded.
