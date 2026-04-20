# Disruptio — Documentação de Features

> **Última atualização**: 2026-03-18 · v6.0

---

1. [Navegação e Layout](#1-navegação-e-layout)
2. [Branding e Logotipos](#2-branding-e-logotipos)
3. [Autenticação](#3-autenticação)
4. [Gestão de Documentos](#4-gestão-de-documentos)
5. [OCR / Extração de Texto](#5-ocr--extração-de-texto)
6. [Pesquisa Inteligente](#6-pesquisa-inteligente)
7. [Chat IA e Assistente da Empresa](#7-chat-ia-e-assistente-da-empresa)
8. [Classificação de Documentos](#8-classificação-de-documentos)
9. [Backoffice (Admin)](#9-backoffice-admin)
10. [UX/UI — Requisitos e Estrutura](#10-uxui--requisitos-e-estrutura)
11. [Stack Tecnológica](#11-stack-tecnológica)
12. [Perfil da Empresa (Company Profile)](#12-perfil-da-empresa-company-profile)
13. [Assistente de Onboarding](#13-assistente-de-onboarding)
14. [Deteção de Lacunas de Conhecimento](#14-deteção-de-lacunas-de-conhecimento)
15. [Definições do Perfil de Utilizador](#15-definições-do-perfil-de-utilizador)
16. [AI Lead Discovery](#16-ai-lead-discovery)
17. [AI Marketing Assistant](#17-ai-marketing-assistant)
18. [AI Sales Assistant](#18-ai-sales-assistant)
19. [Dashboard Home](#19-dashboard-home)
20. [Internacionalização (i18n)](#20-internacionalização-i18n)
21. [Setup Wizard e First-Login](#21-setup-wizard-e-first-login)
22. [SmartInput — Voz e Reescrita IA](#22-smartinput--voz-e-reescrita-ia)
23. [AI Brain Profiles](#23-ai-brain-profiles)
24. [AI Product Assistant](#24-ai-product-assistant)
25. [Client & Project Workspaces](#25-client--project-workspaces)
26. [VoiceRantBrief — Voice Briefing & Auto-Fill](#26-voicerantbrief--voice-briefing--auto-fill)
27. [Standardized Markdown Rendering](#27-standardized-markdown-rendering)
28. [AI Tasks / Execution Workspace](#28-ai-tasks--execution-workspace)

---

## 1. Navegação e Layout

### Estrutura de Navegação

A aplicação utiliza um layout com **sidebar lateral** organizada em **grupos colapsáveis**:

```
┌──────────────┬─────────────────────────────────────────┐
│ Sidebar      │                                         │
│              │         Conteúdo da Página               │
│ 🏠 Dashboard │                                         │
│              │                                         │
│ ▸ Setup      │                                         │
│   🏢 Perfil  │                                         │
│   📁 Projects│                                         │
│   🎓 Onboard │                                         │
│   🧠 AI Brain│                                         │
│              │                                         │
│ ▸ Knowledge  │                                         │
│   📄 Docs    │                                         │
│   🏷️ Classif │                                         │
│   💡 Lacunas │                                         │
│              │                                         │
│ ▸ AI Work.   │                                         │
│   🤖 Chat    │                                         │
│   🏢 Advisor │                                         │
│   🔍 Search  │                                         │
│              │                                         │
│ ▸ Execution  │                                         │
│   ✅ Tasks   │                                         │
│              │                                         │
│ ▸ Growth     │                                         │
│   🎯 Leads   │                                         │
│   📣 Market  │                                         │
│   📦 Product │                                         │
│   💰 Sales   │                                         │
│ ─────────────│                                         │
│ ⚙️ Settings  │                                         │
│ 👤 Nome      │                                         │
│ 🚪 Sair      │                                         │
└──────────────┴─────────────────────────────────────────┘
```

### Sidebar — Grupos de Navegação

A sidebar é fixa e organizada em **5 grupos colapsáveis** (com botão chevron). O grupo que contém a rota ativa é expandido automaticamente.

| Grupo       | Item                    | Rota                    | Ícone | Feature Flag       |
|-------------|-------------------------|-------------------------|-------|--------------------|
| _(sem grupo)_ | Dashboard             | `/dashboard`            | 🏠    | —                  |
| **Setup**   | Perfil da Empresa       | `/company/profile`      | 🏢    | —                  |
| **Setup**   | Project Workspaces      | `/projects`             | 📁    | `projects_workspaces` |
| **Setup**   | Assistente Onboarding   | `/onboarding-assistant` | 🎓    | —                  |
| **Setup**   | AI Brain                | `/settings/ai-brain`    | 🧠    | —                  |
| **Knowledge** | Documentos            | `/documents`            | 📄    | `documents`        |
| **Knowledge** | Extração de Dados     | `/classifications`      | 🏷️    | `classifications`  |
| **Knowledge** | Lacunas de Conhecimento | `/knowledge-gaps`     | 💡    | —                  |
| **AI Workspace** | Chat IA            | `/chat`                 | 🤖    | —                  |
| **AI Workspace** | Assistente Empresa | `/company-advisor`      | 🏢    | —                  |
| **AI Workspace** | Pesquisa           | `/search`               | 🔍    | `search`           |
| **Growth**  | Lead Discovery          | `/leads`                | 🎯    | `leads`            |
| **Growth**  | Marketing Assistant     | `/marketing`            | 📣    | `marketing`        |
| **Growth**  | Product Assistant       | `/product`              | 📦    | `product_assistant`|
| **Growth**  | Sales Assistant         | `/sales`                | 💰    | `sales`            |
| **Execution** | Tasks                 | `/tasks`                | ✅    | `tasks`            |

**Rodapé do Sidebar**:
- Link **⚙️ Settings** para `/settings`.
- **User Profile Card**: avatar, nome, email — clicar navega para `/settings`.
- Botão **"🚪 Sair"** para logout via Supabase Auth.

**Feature Guard**: O layout verifica `/api/user/features` ao carregar e redireciona o utilizador para `/dashboard` caso tente aceder a uma página que requer uma funcionalidade desativada.

**Onboarding Gating**: Antes de renderizar, o layout consulta `/api/user/onboarding-status`. Se `mustChangePassword` → redireciona para `/first-login`. Se `onboardingStatus ≠ COMPLETED` → redireciona para `/setup`.

**Rota raiz `/`**: Redireciona automaticamente para `/dashboard`.

**Layout responsivo**: Sidebar colapsada em mobile com hamburger menu e overlay escuro.

### Ficheiros Relevantes

- `src/app/(dashboard)/layout.tsx` — Layout principal com sidebar agrupada, feature guards, onboarding gating, user profile card
- `src/app/(dashboard)/dashboard.css` — Estilos do layout, sidebar, grupos e user profile card
- `src/app/(dashboard)/page.tsx` — Redirect de `/` para `/dashboard`

---

## 2. Branding e Logotipos

### Logos da Marca

Quatro variantes do logotipo em `public/logos/`:

| Ficheiro           | Uso                                        | Contexto                     |
|--------------------|--------------------------------------------|------------------------------|
| `logo_black.png`   | Texto preto + vermelho                     | Fundos claros (sidebar, auth)|
| `logo_white.png`   | Texto vermelho puro                        | Fundos escuros (backoffice)  |
| `icon_black.png`   | Ícone "D" preto + vermelho                | Favicon (browser tema claro) |
| `icon_white.png`   | Ícone "D" vermelho puro                   | Favicon (browser tema escuro)|

### Favicon Adaptativo

O favicon muda automaticamente com o tema do browser usando media queries `prefers-color-scheme`:

```tsx
// src/app/layout.tsx
icons: {
  icon: [
    { url: '/logos/icon_black.png', media: '(prefers-color-scheme: light)' },
    { url: '/logos/icon_white.png', media: '(prefers-color-scheme: dark)' },
  ],
}
```

### Aplicação dos Logos

| Localização            | Logo Usado      | Razão                    |
|------------------------|-----------------|--------------------------|
| Dashboard sidebar      | `logo_black`    | Fundo claro/branco       |
| Login / Signup          | `logo_black`    | Fundo claro              |
| Backoffice sidebar     | `logo_white`    | Fundo escuro (`dark-band`)|

---

## 3. Autenticação

### Login e Registo

- **Provider**: Supabase Auth
- **Métodos**: Email/Password e Google OAuth
- **Páginas**: `/login` e `/signup`
- **Callback OAuth**: `src/app/api/auth/callback/route.ts`

### Fluxo de Login

1. Utilizador preenche email + password ou clica "Continuar com Google".
2. Supabase valida credenciais e emite cookie de sessão.
3. Redirecionamento para `/` → `/documents`.

### Auto-provisioning de Utilizadores

A função `ensureDbUser()` em `src/lib/user.ts` (chamada por `getCurrentUser()` em `src/lib/auth.ts`):
- Ao autenticar, verifica se o `User` existe na BD local por **email** (`eq('email', email)`).
- **Importante**: O lookup é feito por email (não pelo Supabase Auth ID). Isto garante que utilizadores criados via backoffice (sem conta Supabase própria) são encontrados corretamente.
- Se não existir, cria automaticamente `Company` + `User`.
- Garante consistência entre Supabase Auth e a BD relacional (via Supabase Data API com cliente admin).

### Multi-tenancy

- Cada `User` pertence a uma `Company` via `companyId`.
- Todos os dados (documentos, chats, classificações) são isolados por `companyId`.

---

## 4. Gestão de Documentos

### Descrição

Módulo central que permite upload, organização em pastas, visualização e eliminação de ficheiros (PDF, DOCX, imagens). Os documentos são armazenados no Supabase Storage e registados na BD PostgreSQL.

### Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Frontend: src/app/(dashboard)/documents/page.tsx        │
│  - Sidebar de Pastas (criar, editar, eliminar)           │
│  - Upload múltiplo com progresso                         │
│  - Tabela de documentos (nome, tipo, tamanho, OCR, data) │
│  - Mover documentos entre pastas                         │
│  - Ações: Executar OCR, Eliminar                         │
└───────────┬──────────────────────────────┬───────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│  API Routes                                              │
│  POST /api/documents/upload       (upload + auto-OCR)    │
│  GET  /api/documents/upload       (listar documentos)    │
│  DELETE /api/documents/[id]       (eliminar documento)   │
│  POST/PUT/DELETE /api/documents/folders (gestão pastas)  │
└───────────┬──────────────────────────────┬───────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────┐    ┌───────────────────────────────┐
│ Supabase Storage    │    │ PostgreSQL (Supabase)          │
│ Bucket: "documents" │    │ Tabelas: Document, DocFolder   │
│ Pasta: /{companyId} │    └───────────────────────────────┘
└─────────────────────┘
```

### Gestão de Pastas

**Modelo `DocFolder`**:

| Campo      | Tipo     | Descrição                           |
|------------|----------|-------------------------------------|
| `id`       | String   | UUID, chave primária                |
| `companyId`| String   | FK para `Company`                   |
| `name`     | String   | Nome da pasta                       |
| `parentId` | String?  | FK para `DocFolder` (subpastas)     |
| `createdAt`| DateTime | Timestamp de criação                |

**Funcionalidades**:
- **Criar pastas**: Modal com campo de nome, via `POST /api/documents/folders`.
- **Editar pastas**: Renomear pasta existente via `PUT /api/documents/folders`.
- **Eliminar pastas**: Com confirmação obrigatória via `DELETE /api/documents/folders`.
- **Subpastas**: Suportadas via relação `parentId` (hierarquia recursiva).
- **Mover documentos**: Drag-and-drop ou seleção — atualiza `folderId` do documento.

### Upload Múltiplo com Progresso

1. Utilizador seleciona múltiplos ficheiros (botão ou drag-and-drop).
2. Cada ficheiro é enviado individualmente com barra de progresso.
3. Estado por ficheiro: `uploading` → `ocr` → `done` / `error`.
4. OCR é executado **automaticamente** após cada upload.

### Modelo de Dados — Document

| Campo                  | Tipo       | Descrição                                      |
|------------------------|------------|-------------------------------------------------|
| `id`                   | String     | UUID, chave primária                            |
| `companyId`            | String     | FK para `Company` — isolamento multi-tenant     |
| `folderId`             | String?    | FK para `DocFolder` (opcional)                  |
| `filename`             | String     | Nome original do ficheiro                       |
| `mimeType`             | String     | Tipo MIME (ex: `application/pdf`)               |
| `size`                 | Int        | Tamanho em bytes                                |
| `storageKey`           | String     | Caminho no Supabase Storage                     |
| `uploadedById`         | String     | FK para `User` que fez upload                   |
| `extractedText`        | String?    | Texto extraído por OCR (`@db.Text`)             |
| `ocrProcessed`         | Boolean    | `true` após processamento OCR concluído         |
| `knowledgeCategory`    | String?    | Categoria de conhecimento para retrieval otimizado |
| `useAsKnowledgeSource` | Boolean    | Fonte curada — prioridade máxima no assistente  |
| `knowledgePriority`    | String?    | `normal` / `preferred` / `critical`             |
| `language`             | String?    | Idioma detetado (reservado para uso futuro)      |
| `hash`                 | String?    | Hash do ficheiro (reservado para deduplicação)  |
| `createdAt`            | DateTime   | Timestamp de criação                            |
| `updatedAt`            | DateTime   | Timestamp de última atualização                 |

### Configurações de Conhecimento (Knowledge Settings)

Cada documento pode ser configurado com metadados de conhecimento que influenciam o ranking no **Assistente da Empresa**:

**Categorias de Conhecimento** (`knowledgeCategory`):

| Valor         | Label       | Descrição                              |
|---------------|-------------|----------------------------------------|
| `company`     | 🏢 Empresa  | Informação geral da empresa            |
| `product`     | 📦 Produto  | Informação sobre produtos/serviços     |
| `process`     | ⚙️ Processo | Processos e procedimentos internos     |
| `onboarding`  | 🚀 Onboarding | Onboarding de clientes/colaboradores |
| `hr`          | 👥 RH       | Recursos humanos                       |
| `policy`      | 📋 Política | Políticas e regulamentos               |
| `finance`     | 💰 Finanças | Informação financeira                  |
| `operations`  | 🔧 Operações | Operações e logística                 |

**Prioridade** (`knowledgePriority`):

| Valor       | Boost no Ranking | Descrição                            |
|-------------|------------------|--------------------------------------|
| `normal`    | —                | Sem boost adicional                  |
| `preferred` | +0.05            | Favorecido nas respostas             |
| `critical`  | +0.10            | Altamente favorecido nas respostas   |

**Fonte Curada** (`useAsKnowledgeSource`):
- Quando `true`, o documento recebe **+0.20 de boost** no ranking.
- Marcado como fonte autoritativa e confiável.

**UI de Configuração**:
- Botão ⚙️ em cada linha do documento na tabela.
- Abre modal com: dropdown de categoria, dropdown de prioridade, toggle de fonte curada.
- Coluna "Conhecimento" na tabela mostra badges: ✓ Curado (verde) ou nome da categoria.

### API Routes — Documentos

| Endpoint                        | Método | Descrição                                   |
|---------------------------------|--------|---------------------------------------------|
| `POST /api/documents/upload`    | POST   | Upload de documento + auto-OCR              |
| `GET /api/documents/upload`     | GET    | Listar documentos da empresa                |
| `PATCH /api/documents/[id]`     | PATCH  | Atualizar documento (pasta, knowledge metadata) |
| `DELETE /api/documents/[id]`    | DELETE | Eliminar documento + embeddings             |
| `POST/PUT/DELETE /api/documents/folders` | — | Gestão de pastas                   |

O endpoint `PATCH` aceita os campos:
- `folderId` — mover documento para pasta
- `knowledgeCategory` — definir categoria de conhecimento
- `useAsKnowledgeSource` — marcar como fonte curada
- `knowledgePriority` — definir prioridade (`normal`, `preferred`, `critical`)

### Document Detail Viewer

- **Componente**: `src/app/(dashboard)/documents/[id]/DocumentViewerModal.tsx`
- **Funcionalidade**: Modal que exibe o conteúdo do documento com chat IA integrado.
- **Utilizado em**: Pesquisa Inteligente e Chat IA (ao clicar num documento referenciado).

### Formatos Suportados

| Tipo    | Extensões                              | MIME Types                                  |
|---------|----------------------------------------|---------------------------------------------|
| PDF     | `.pdf`                                 | `application/pdf`                           |
| Word    | `.doc`, `.docx`                        | `application/msword`, `application/vnd...`  |
| Imagem  | `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp`| `image/png`, `image/jpeg`, `image/tiff`    |
| Texto   | `.txt`, `.md`                          | `text/plain`, `text/markdown`               |

**Nota sobre ficheiros `.md`**: Documentos Markdown são suportados nativamente e renderizados diretamente no painel visualizador usando formatação similar ao chat (negrito, itálicos, listas).

### Segurança

- **Autenticação**: Todos os endpoints verificam cookie de sessão Supabase.
- **Multi-tenant**: Documentos isolados por `companyId`.
- **Ownership**: Eliminação verifica que o `companyId` corresponde ao utilizador autenticado.
- **Storage privado**: Bucket `documents` criado como `{ public: false }`.

---

## 5. OCR / Extração de Texto

### Descrição

Extrai texto de documentos carregados, utilizando motores diferentes consoante o tipo de ficheiro. O texto extraído é guardado no campo `extractedText` e fica disponível para pesquisa e classificação.

### Motores de Extração

| Tipo de Ficheiro | Biblioteca/Serviço  | Método                                            |
|------------------|---------------------|---------------------------------------------------|
| **PDF**          | `pdf-parse` (v2)    | Parsing local — converte PDF para texto           |
| **DOCX / DOC**   | `mammoth`           | Parsing local — Word para raw text                |
| **Imagens**      | OpenAI GPT-4o Vision| Envia imagem em base64 para reconhecimento OCR    |
| **Outros**       | `Blob.text()`       | Fallback — leitura como texto puro                |

### Fluxo

1. **Autenticação** e validação do `documentId`.
2. **Download** do ficheiro do Supabase Storage via `storageKey`.
3. **Deteção de tipo** por `mimeType` → seleciona motor correto.
4. **Extração** de texto com o motor selecionado.
5. **Persistência**: atualiza `extractedText` e `ocrProcessed = true`.
6. **Auto-trigger**: OCR é executado automaticamente após upload.

### OCR de Imagens — Prompt GPT-4o

> *"Extract ALL text from this image. Return only the extracted text, preserving the original structure and formatting as much as possible. If the image contains tables, reproduce them."*

- **Max tokens**: 4096
- **Modelo**: `gpt-4o`
- **Requisito**: variável `OPENAI_API_KEY` configurada.

### Ficheiro: `src/app/api/ocr/route.ts`

---

## 6. Pesquisa Inteligente

### Descrição

Interface de pesquisa semântica sobre o conteúdo dos documentos. Suporta **pesquisa vetorial** (via embeddings OpenAI) com fallback para **pesquisa textual** (ILIKE).

### Arquitetura

```
┌──────────────────────────────────────────────────────┐
│  Frontend: src/app/(dashboard)/search/page.tsx       │
│  - Barra de pesquisa com linguagem natural           │
│  - Filtros: tipo de ficheiro, intervalo de datas     │
│  - Resultados com resumo IA + score de relevância    │
│  - Botão "Ver documento" → abre DocumentViewerModal  │
└───────────────┬──────────────────────────────────────┘
                │ GET /api/search?q=...&type=...&from=...&to=...
                ▼
┌──────────────────────────────────────────────────────┐
│  API Route: src/app/api/search/route.ts              │
│                                                      │
│  1. Se OPENAI_API_KEY → vectorSearch()               │
│     - Gera embedding da query                        │
│     - Cosine similarity contra DocumentEmbedding     │
│  2. Senão → textSearch() (fallback ILIKE)            │
│  3. generateSummaries() — GPT-4o-mini resume cada    │
│     resultado no contexto da pergunta                │
└──────────────────────────────────────────────────────┘
```

### Funcionalidades

- **Pesquisa Vetorial** (`vectorSearch`): Gera embedding da query via `text-embedding-3-small`, calcula cosine similarity contra `DocumentEmbedding`. Top 10 resultados.
- **Pesquisa Textual** (`textSearch`): Fallback via SQL `ILIKE` no `extractedText`.
- **Resumos IA** (`generateSummaries`): GPT-4o-mini gera resumos contextuais para cada resultado, respondendo à pergunta do utilizador com base no conteúdo do documento.
- **Filtros**: Tipo de ficheiro (PDF/DOCX/Imagem), intervalo de datas.
- **highlight de texto**: Palavras da pesquisa destacadas nos snippets.

### Modelo de Dados — DocumentEmbedding

| Campo        | Tipo   | Descrição                                     |
|--------------|--------|-----------------------------------------------|
| `id`         | String | UUID                                          |
| `companyId`  | String | FK para `Company`                             |
| `documentId` | String | FK para `Document` (cascade delete)           |
| `chunkIndex` | Int    | Índice do chunk dentro do documento            |
| `chunkText`  | String | Texto do chunk original (`@db.Text`)          |
| `embedding`  | String | Vetor de embedding como JSON (`@db.Text`)     |

---

## 7. Chat IA e Assistente da Empresa

### Descrição

Chat conversacional com IA que suporta três modos, cada um com a sua **rota dedicada** e um componente partilhado `ChatInterface`. Os três modos são: **Chat Geral** (RAG sobre documentos), **Assistente da Empresa** (Company Knowledge) e **Assistente de Onboarding** (ver secção 13).

### Rotas Separadas

Em vez de um dropdown de seleção de modo, cada tipo de assistente tem a sua própria rota:

| Rota                    | `assistantType`        | Componente                      |
|-------------------------|------------------------|---------------------------------|
| `/chat`                 | `GENERAL`              | `ChatInterface fixedType="GENERAL"` |
| `/company-advisor`      | `COMPANY_KNOWLEDGE`    | `ChatInterface fixedType="COMPANY_KNOWLEDGE"` |
| `/onboarding-assistant` | `ONBOARDING_ASSISTANT` | `ChatInterface fixedType="ONBOARDING_ASSISTANT"` |

Todas as rotas usam o componente partilhado `src/components/chat/ChatInterface.tsx`, que recebe a prop `fixedType` para definir o tipo de assistente sem dropdown.

### Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend: src/components/chat/ChatInterface.tsx              │
│  - Prop fixedType determina o modo (sem dropdown)            │
│  - Sidebar de conversas filtradas por tipo                   │
│  - Área de mensagens com rendering markdown                  │
│  - Badges de fundamentação (VERIFIED / PARTIAL / NOT_FOUND)  │
│  - Fontes com preview tooltip                                │
│  - Prompts sugeridos (contextuais ao tipo)                   │
│  - Input com: texto, voz (Web Speech API), ficheiros         │
└───────────────────────┬──────────────────────────────────────┘
                        │ POST /api/chat { message, conversationId, assistantType }
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  API Route: src/app/api/chat/route.ts                        │
│                                                              │
│  Se assistantType = GENERAL:                                 │
│    findRelevantChunks() → top 5 por cosine similarity        │
│                                                              │
│  Se assistantType = COMPANY_KNOWLEDGE:                       │
│    classifyCompanyQueryIntent() → intent (8 tipos)           │
│    findRelevantCompanyKnowledge() → 4-stage pipeline:        │
│      Stage 1: Candidate Retrieval (top 20)                   │
│      Stage 2: Metadata Enrichment (knowledge fields)         │
│      Stage 3: Composite Ranking (scoreCandidate)             │
│      Stage 4: Final Selection (dedup, diversity, max 8)      │
│    buildOptimizedCompanyContext() → structured prompt         │
│                                                              │
│  evaluateGroundingStatus() → VERIFIED / PARTIAL / NOT_FOUND  │
│  buildResponseSources() → top 3, dedup, preview              │
│                                                              │
│  Chama GPT-4o-mini para gerar resposta                       │
│  Persiste mensagens na BD (Conversation + Message)           │
└──────────────────────────────────────────────────────────────┘
```

### Modos do Chat

| Modo                         | `assistantType`        | Retrieval Pipeline                   | Funcionalidades Exclusivas                          |
|------------------------------|------------------------|--------------------------------------|-----------------------------------------------------|
| **Chat Geral**               | `GENERAL`              | Cosine similarity → top 5            | Respostas baseadas em documentos                    |
| **Assistente da Empresa**    | `COMPANY_KNOWLEDGE`    | 4-stage ranked pipeline → top 8      | Intent, grounding, perfil empresa, question logging |
| **Assistente de Onboarding** | `ONBOARDING_ASSISTANT` | Onboarding pipeline com role boosts  | Landing panel, role selector, guia IA, docs recomendados |

### Classificação de Intenções (Intent Classifier)

Função `classifyCompanyQueryIntent(question)` — keyword-based, zero latency, suporta PT e EN.

| Intent            | Exemplo de Pergunta                    | Categorias Relevantes          |
|-------------------|----------------------------------------|--------------------------------|
| `COMPANY_OVERVIEW`| "O que a nossa empresa faz?"           | company, product, general      |
| `PRODUCT`         | "Quais são os nossos produtos?"        | product, company               |
| `PROCESS`         | "Como funciona o onboarding de cliente?" | process, onboarding, operations |
| `POLICY`          | "Qual é a nossa política de privacidade?" | policy, compliance, hr       |
| `ONBOARDING`      | "Como integrar um novo colaborador?"   | onboarding, process, hr        |
| `HR`              | "Qual é a política de férias?"         | hr, policy                     |
| `FINANCE`         | "Como funciona o processo de faturação?" | finance, operations          |
| `GENERAL`         | "Quero saber mais sobre..."            | (sem boost de categoria)       |

### Pipeline de Retrieval (4 Estágios)

**Estágio 1 — Candidate Retrieval**:
- Gera embedding da mensagem via `text-embedding-3-small`.
- Cosine similarity contra `DocumentEmbedding` (isolado por `companyId`).
- Filtra candidatos com similarity ≥ 0.2.
- Toma top 20 candidatos.

**Estágio 2 — Metadata Enrichment**:
- Join com tabela `Document` para obter: `knowledgeCategory`, `useAsKnowledgeSource`, `knowledgePriority`, `updatedAt`.

**Estágio 3 — Composite Ranking**:
```
finalScore =
  semanticSimilarity         (base 0-1)
  + categoryBoost            (+0.15 se categoria corresponde ao intent)
  + knowledgeSourceBoost     (+0.20 se useAsKnowledgeSource = true)
  + priorityBoost            (+0.05 preferred, +0.10 critical)
  + recencyBoost             (+0.03 se atualizado nos últimos 30 dias)
  - noisePenalty             (-0.10 se chunk < 50 caracteres)
```

**Estágio 4 — Final Selection**:
- Remove near-duplicates (Levenshtein similarity > 0.85).
- Máximo 2 chunks por documento (diversidade).
- Skip chunks < 30 caracteres.
- Retorna top 5-8 chunks finais.

### Estados de Fundamentação (Grounding Status)

| Estado       | Condição                                              | Badge UI      | Cor   |
|-------------|-------------------------------------------------------|---------------|-------|
| `VERIFIED`  | Top score ≥ 0.85, ou ≥ 0.75 com 2+ chunks relevantes | 🟢 Verificado  | Verde |
| `PARTIAL`   | Top score ≥ 0.4                                       | 🟡 Parcial     | Amarelo|
| `NOT_FOUND` | Sem chunks relevantes ou scores < 0.4                 | 🔴 Não encontrado | Vermelho |

- **`NOT_FOUND`**: Secção de fontes é ocultada.
- **Badge é mostrado ACIMA das fontes** na UI.

### Atribuição de Fontes (Source Attribution)

Cada resposta do assistente inclui:
```json
{
  "answer": "...",
  "conversationId": "...",
  "assistantType": "COMPANY_KNOWLEDGE",
  "groundingStatus": "VERIFIED",
  "usedCompanyProfile": true,
  "sources": [
    {
      "documentId": "doc_123",
      "filename": "Onboarding Process.pdf",
      "preview": "The onboarding process includes creating the client in CRM...",
      "relevanceScore": 0.87
    }
  ]
}
```

- **Deduplicação**: Uma fonte por `documentId` (mantém melhor score).
- **Preview**: 180 caracteres do chunk, normalizado (sem newlines duplicados).
- **Máximo**: 3 fontes na resposta.

### Perfil da Empresa (Company Profile Injection)

- Função `shouldUseCompanyProfile(queryIntent)` — incluído para intents: `COMPANY_OVERVIEW`, `PRODUCT`, `GENERAL`.
- Dados: nome, plano, email, features ativadas.
- Complementa (não substitui) evidência documental.

### Funcionalidades do Frontend (`ChatInterface`)

| Feature                    | Detalhes                                              |
|----------------------------|-------------------------------------------------------|
| **Modo fixo por rota**     | Prop `fixedType` determina o tipo — sem dropdown      |
| **Conversas filtradas**    | Lista lateral filtrada por `assistantType`             |
| **Mensagens**              | User/Assistant com rendering markdown (bold, listas)   |
| **Prompts sugeridos**      | Dinâmicos por tipo e role (onboarding)                 |
| **Badges de grounding**    | VERIFIED (verde), PARTIAL (amarelo), NOT_FOUND (vermelho) |
| **Fontes com preview**     | Tags clicáveis com tooltip mostrando preview do chunk  |
| **Input por texto**        | Textarea com auto-resize, envio com Enter              |
| **Input por voz**          | Web Speech API (`pt-PT`), botão 🎙️ com estado recording |
| **Upload de ficheiros**    | Botão 📎 para anexar documentos ao chat                |
| **Typing indicator**       | Animação de 3 pontos enquanto IA processa              |

### Modelo de Dados

**Conversation**:
| Campo            | Tipo     | Descrição                                          |
|------------------|----------|----------------------------------------------------||
| `id`             | String   | UUID                                               |
| `companyId`      | String   | FK para `Company`                                  |
| `userId`         | String   | FK para `User`                                     |
| `title`          | String?  | Título gerado da conversa                          |
| `assistantType`  | String   | `GENERAL`, `COMPANY_KNOWLEDGE`, `ONBOARDING_ASSISTANT` |
| `onboardingRole` | String?  | Papel do utilizador no onboarding (ex: `sales`, `hr`) |
| `createdAt`      | DateTime | Timestamp de criação                               |
| `updatedAt`      | DateTime | Última atualização                                 |

**Message**:
| Campo           | Tipo     | Descrição                            |
|-----------------|----------|--------------------------------------|
| `id`            | String   | UUID                                 |
| `conversationId`| String   | FK para `Conversation` (cascade)     |
| `role`          | String   | `USER` ou `ASSISTANT`                |
| `content`       | String   | Conteúdo da mensagem (`@db.Text`)    |
| `createdAt`     | DateTime | Timestamp de criação                 |

### API Routes

| Endpoint                                         | Método | Descrição                                                   |
|--------------------------------------------------|--------|-------------------------------------------------------------|
| `/api/chat`                                      | POST   | Enviar mensagem (suporta GENERAL, COMPANY_KNOWLEDGE, ONBOARDING_ASSISTANT) |
| `/api/chat/conversations`                        | GET    | Listar todas as conversas do utilizador                     |
| `/api/chat/conversations/[id]`                   | GET    | Obter mensagens de uma conversa                             |
| `/api/chat/conversations/[id]`                   | DELETE | Eliminar conversa                                           |
| `/api/company/onboarding-guide`                  | GET    | Obter guia de onboarding gerado para a empresa              |
| `/api/company/onboarding-guide/generate`         | POST   | Gerar guia de onboarding via IA (usa perfil + documentos)   |

### Modelos IA Utilizados

- **Embedding**: `text-embedding-3-small` (para pesquisa de chunks relevantes)
- **Chat**: `gpt-4o-mini` (para geração de respostas)

### Ficheiros Relevantes

- `src/components/chat/ChatInterface.tsx` — Componente partilhado de chat (usado por todas as rotas)
- `src/components/chat/chat.css` — Estilos do chat
- `src/app/(dashboard)/chat/page.tsx` — Página `/chat` (Chat Geral, `fixedType="GENERAL"`)
- `src/app/(dashboard)/company-advisor/page.tsx` — Página `/company-advisor` (`fixedType="COMPANY_KNOWLEDGE"`)
- `src/app/(dashboard)/onboarding-assistant/page.tsx` — Página `/onboarding-assistant` (`fixedType="ONBOARDING_ASSISTANT"`)
- `src/app/api/chat/route.ts` — API com pipeline de retrieval, grounding, e geração

---

## 8. Classificação de Documentos

### Descrição

Sistema completo de classificação e extração de dados a partir de documentos usando IA. Permite definir tipos de classificação personalizados, processar documentos (individual ou em batch), rever e **editar inline** os resultados com persistência na BD, e exportar dados.

### Arquitetura

```
┌────────────────────────────────────────────────────────────┐
│  Frontend: src/app/(dashboard)/classifications/page.tsx    │
│                                                            │
│  Tab 1: Tipos de Classificação                             │
│    - Criar/Editar/Eliminar tipos                           │
│    - Definição de campos (nome, tipo, descrição)           │
│    - Prompt IA customizável com refinamento automático     │
│    - Sugestão de campos via IA                             │
│                                                            │
│  Tab 2: Classificar Documento                              │
│    - Selecionar tipo de classificação                      │
│    - Navegar pastas e selecionar documentos (individual/batch)
│    - Processar e visualizar resultados em tabela           │
│    - Modal de detalhe com navegação entre documentos       │
│    - Edição inline dos campos extraídos                    │
│    - Exportar para Excel e imagens                         │
│                                                            │
│  Tab 3: Histórico                                          │
│    - Lista de runs anteriores (agrupados por batchId)      │
│    - Drill-down para ver resultados detalhados             │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│  API Routes                                                │
│  GET/POST   /api/classifications                (CRUD tipos) │
│  PUT/DELETE /api/classifications/[id]           (editar/elim)│
│  POST       /api/classifications/classify-batch  (batch)     │
│  POST       /api/classifications/refine-prompt   (IA prompt) │
│  POST       /api/classifications/export-excel    (Excel)     │
│  POST       /api/classifications/export-images   (imagens)   │
│  GET        /api/classifications/history         (histórico) │
│  GET/PUT    /api/classifications/results/[id]    (resultado) │
└────────────────────────────────────────────────────────────┘
```

### Tab 1 — Tipos de Classificação

**Funcionalidades**:
- **Criar tipo**: Nome, descrição, definição de campos, prompt IA.
- **Editar tipo**: Modal de edição com os mesmos campo do formulário de criação.
- **Eliminar tipo**: Com confirmação obrigatória.
- **Sugerir campos via IA**: Botão "Sugerir campos" envia o prompt ao GPT para sugerir campo automaticamente.
- **Refinar prompt via IA**: Botão "Refinar com IA" melhora o prompt do utilizador usando GPT.
- **Input por voz**: Web Speech API para ditar o prompt.

**Modelo `ClassificationType`**:

| Campo              | Tipo     | Descrição                              |
|--------------------|----------|----------------------------------------|
| `id`               | String   | UUID                                   |
| `companyId`        | String   | FK para `Company`                      |
| `createdById`      | String   | FK para `User`                         |
| `name`             | String   | Nome do tipo (ex: "Fatura")            |
| `description`      | String?  | Descrição opcional                     |
| `aiPrompt`         | String   | Prompt IA para extração (`@db.Text`)   |
| `fieldDefinitions` | Json     | Array de `{ name, type, description }` |
| `isTemplate`       | Boolean  | Se é template global                   |
| `createdAt`        | DateTime | Timestamp de criação                   |

### Tab 2 — Classificar Documento

**Fluxo de Classificação (Batch)**:

1. **Selecionar tipo** de classificação.
2. **Navegar pastas** e selecionar documentos (com breadcrumbs, select-all por pasta).
3. **Processar**: Envia documentos para `POST /api/classifications/classify-batch`.
4. **Backend**: Para cada documento:
   - Busca `extractedText` do documento.
   - Chama OpenAI (`gpt-4o-mini`) com o prompt e texto extraído.
   - Parseia resposta JSON → campos extraídos.
   - Calcula confiança média.
   - Cria `ClassificationResult` + `ClassificationHistory` (com `batchId` para agrupar).
5. **Resultados**: Tabela com colunas dinâmicas (campos definidos) + confiança.

**Cards de Resumo**:
- **Total Documentos**: Número de documentos processados.
- **Média de Confiança**: Percentagem média de confiança dos resultados.

**Modal de Detalhe**:
- Visão lado a lado: documento original + campos extraídos.
- **Edição inline**: Campos extraídos são inputs editáveis pelo utilizador.
- **Guardar Correções**: Botão "Guardar Alterações" persiste os valores corrigidos via `PUT /api/classifications/results/[id]`.
- A correção atualiza o registo em `ClassificationResult.extractedFields` na BD e sincroniza a tabela de resultados no frontend sem necessidade de recarregar.
- **Navegação**: Botões ◀ ▶ para navegar entre documentos do batch.
- **Contador**: "Documento X de N".

**Exportação**:
- **Excel**: `POST /api/classifications/export-excel` — gera ficheiro `.xlsx` com todos os campos.
- **Imagens**: `POST /api/classifications/export-images` — exporta imagens originais dos documentos com ficheiro Excel associado.

**Modelo `ClassificationResult`**:

| Campo                  | Tipo     | Descrição                              |
|------------------------|----------|----------------------------------------|
| `id`                   | String   | UUID                                   |
| `companyId`            | String   | FK para `Company`                      |
| `documentId`           | String   | FK para `Document` (cascade delete)    |
| `classificationTypeId` | String   | FK para `ClassificationType`           |
| `extractedFields`      | Json     | Campos extraídos `{ campo: valor }`    |
| `confidence`           | Float?   | Nível de confiança (0-1)               |
| `status`               | String   | `completed` / `error`                  |
| `createdAt`            | DateTime | Timestamp de criação                   |

### Tab 3 — Histórico

**Funcionalidades**:
- Lista de **runs** anteriores agrupados por `batchId`.
- Cada run mostra: tipo de classificação, nº documentos, confiança média, data.
- **Drill-down**: Clicar num run abre a mesma vista de tabela + modal da Tab 2.

**Modelo `ClassificationHistory`**:

| Campo                    | Tipo     | Descrição                            |
|--------------------------|----------|--------------------------------------|
| `id`                     | String   | UUID                                 |
| `companyId`              | String   | FK para `Company`                    |
| `userId`                 | String   | FK para `User`                       |
| `classificationTypeId`   | String   | FK para `ClassificationType`         |
| `classificationResultId` | String?  | FK para `ClassificationResult`       |
| `action`                 | String   | Ação realizada (ex: `classify`)      |
| `metadata`               | Json?    | Contém `batchId`, `confidence`, etc. |
| `createdAt`              | DateTime | Timestamp de criação                 |

### API Route — Batch Classify

**`POST /api/classifications/classify-batch`**:

```
Request: { classificationTypeId, documentIds[] }
Response: { results: ClassificationResult[], errors: string[] }
```

Para cada documento:
1. Busca `extractedText` e `ClassificationType.aiPrompt`.
2. Gera uid `batchId` único para o batch.
3. Chama OpenAI (`gpt-4o-mini`) com system prompt estruturado.
4. Parseia resposta JSON → `extractedFields` + `confidence`.
5. Cria `ClassificationResult` na BD.
6. Cria `ClassificationHistory` com `batchId` no `metadata`.

### API Route — Resultado Individual

**`GET /api/classifications/results/[id]`**: Obtém um resultado específico por `id`, incluindo o documento e tipo de classificação associados. Verifica `companyId` para isolamento multi-tenant.

**`PUT /api/classifications/results/[id]`**: Atualiza os campos extraídos de um resultado (correção manual pelo utilizador).

```
Request:  { extractedFields?: Record<string, string>, feedback?: string }
Response: ClassificationResult atualizado
```

- Se `extractedFields` fornecido → atualiza `ClassificationResult.extractedFields`.
- Se `feedback` fornecido → cria registo em `ClassificationHistory` com `action: 'feedback'`.
- Verifica ownership por `companyId` antes de qualquer escrita.

---

## 9. Backoffice (Admin)

### Descrição

Painel de administração para utilizadores com role `SUPER_ADMIN`. Permite gerir empresas, funcionalidades, e ver analytics globais.

### Acesso

- Verificação de role via API no carregamento do layout.
- Utilizadores sem `SUPER_ADMIN` são redirecionados para `/`.

### Funcionalidades

| Funcionalidade           | Descrição                                                                         |
|--------------------------|-----------------------------------------------------------------------------------|
| **Gestão de Empresas**   | Listar, criar, editar/eliminar empresas com pesquisa e filtro por plano           |
| **Criação de Empresas**  | Formulário com nome, email, plano, idioma, website e LinkedIn URL (optional)      |
| **Web Scraping**         | Enriquecimento automático do perfil via scraping do website/LinkedIn após criação |
| **Feature Flags**        | Ativar/desativar funcionalidades por empresa (página de detalhe)                  |
| **Gestão de Planos**     | Starter / Pro / Enterprise (com licença e expiração)                              |
| **Gestão de Utilizadores** | Ver utilizadores de uma empresa, enviar convites                                |
| **Analytics**            | Métricas globais (nº empresas, utilizadores, etc.)                                |
| **Detalhe da Empresa**   | Página individual `/backoffice/companies/[id]` com gestão completa               |

### Navegação do Backoffice

- Sidebar próprio com fundo escuro (`var(--color-bg-dark-band)`).
- Logo branco (`logo_white.png`) + badge "Admin".
- Links: Empresas, Analytics, Voltar ao Dashboard.

### API Routes

| Endpoint                                       | Método | Descrição                                    |
|------------------------------------------------|--------|----------------------------------------------|
| `/api/backoffice/analytics`                    | GET    | Métricas globais                             |
| `/api/backoffice/companies`                    | GET    | Listar empresas (suporta search e plan filter)|
| `/api/backoffice/companies`                    | POST   | Criar empresa (name, email, plan, language, website, linkedinUrl) |
| `/api/backoffice/companies/[id]`               | GET    | Detalhe de uma empresa                       |
| `/api/backoffice/companies/[id]`               | DELETE | Eliminar empresa                             |
| `/api/backoffice/companies/[id]/features`      | GET/PUT | Gestão de feature flags da empresa           |
| `/api/backoffice/companies/[id]/license`       | GET/PUT | Gestão de licença/plano                      |
| `/api/backoffice/companies/[id]/users`         | GET    | Utilizadores de uma empresa                  |
| `/api/backoffice/companies/[id]/send-invite`   | POST   | Enviar convite a utilizador                  |
| `/api/backoffice/companies/[id]/scrape-web`    | POST   | Scraping web para enriquecer perfil          |

### Ficheiros

- `src/app/backoffice/layout.tsx` — Layout do backoffice
- `src/app/backoffice/page.tsx` — Página de gestão de empresas (lista + criação)
- `src/app/backoffice/companies/[id]/page.tsx` — Página de detalhe da empresa
- `src/app/backoffice/analytics/page.tsx` — Página de analytics
- `src/app/backoffice/backoffice.css` — Estilos específicos

---

## 10. UX/UI — Requisitos e Estrutura

### Princípios Gerais de Design

| Princípio                | Implementação                                          |
|--------------------------|--------------------------------------------------------|
| **Consistência visual**  | Design system com CSS variables (cores, espaçamentos, tipografia) |
| **Feedback imediato**    | Toasts de sucesso/erro, indicadores de loading, typing indicators |
| **Hierarquia clara**     | Headers, subtítulos, badges, e iconografia para guiar o utilizador |
| **Multi-tenant isolation**| Todos os dados filtrados por `companyId` — sem mistura de dados |
| **Responsive design**    | Layout adaptativo para desktop e mobile (sidebar colapsável) |

### Paleta de Cores

| Token                        | Valor Padrão       | Uso                         |
|------------------------------|--------------------|-----------------------------||
| `--color-accent-red`         | `#D73A3A`          | Ações primárias, branding   |
| `--color-bg-primary`         | `#F7F7F8`          | Fundo geral da aplicação    |
| `--color-bg-surface`         | `#F0F0F2`          | Fundo de cartões/painéis    |
| `--color-text-primary`       | `#1A1A2E`          | Texto principal             |
| `--color-text-secondary`     | `#6B7280`          | Texto secundário/subtítulos |
| `--color-state-success`      | `#10B981`          | Confirmações, badges verdes |
| `--color-state-error`        | `#EF4444`          | Erros, ações destrutivas    |
| `--color-stroke-subtle`      | `#E5E7EB`          | Bordas e separadores        |

### Tipografia

- **Font family**: `Inter` (Google Fonts)
- **Font sizes**: CSS variables (`--font-size-body`, `--font-size-small`, `--font-size-caption`)
- **Weight hierarchy**: 400 (body), 500 (medium), 600 (semibold), 700 (bold)

### Componentes Reutilizáveis

| Componente            | Ficheiro                                     | Uso                                  |
|---------------------|----------------------------------------------|--------------------------------------|
| `FeatureTabs`       | `src/components/FeatureTabs.tsx`              | Navegação horizontal entre features |
| `UIFeedback`        | `src/components/UIFeedback.tsx`               | Toasts, modais de confirmação       |
| `PageHeader`        | `src/components/PageHeader.tsx`               | Cabeçalho de página com secção, título, descrição e ação |
| `ChatInterface`     | `src/components/chat/ChatInterface.tsx`       | Componente partilhado de chat (3 modos) |
| `SmartInput`        | `src/components/SmartInput.tsx`               | Input com voz (Speech-to-Text) e reescrita IA (ver secção 22) |
| `VoiceRantBrief`    | `src/components/VoiceRantBrief.tsx`            | Briefing por voz com auto-fill de formulários via IA (ver secção 26) |
| `WorkspaceSelector` | `src/components/WorkspaceSelector.tsx`         | Dropdown para selecionar projeto/workspace ativo (ver secção 25) |
| `DocumentViewerModal`| `src/app/.../DocumentViewerModal.tsx`        | Visualização de documentos   |

### Padrões de Modal

Todos os modais seguem o mesmo padrão CSS:

```
┌──────────────────────────────────────┐
│  .class-modal-header                 │
│  ┌─ h3 (título)          ✕ close ──┐ │
├──────────────────────────────────────┤
│  .class-modal-body                   │
│  - Formulários, conteúdo             │
│  - .form-group + .label + .input     │
│  - .form-hint (texto descritivo)     │
├──────────────────────────────────────┤
│  .class-modal-footer                 │
│  [Cancelar]               [Guardar]  │
└──────────────────────────────────────┘
```

- **Overlay**: `rgba(0, 0, 0, 0.55)` com `backdrop-filter: blur(6px)`
- **Animação**: `fadeIn` + `scaleIn` (0.15s / 0.2s)
- **Largura**: `min(480px, 95vw)` (adaptativo)
- **Fechar**: Click no overlay ou botão ✕

### Padrões de Tabela

- Tabelas com `.table-wrapper` para scroll horizontal em mobile.
- Headers com `<th>` — fundo claro, texto uppercase.
- Badges para estados: `.badge-success` (verde), `.badge-warning` (amarelo), `.badge-neutral` (cinza).
- Última coluna com `position: relative` para dropdowns absolutos.

### Padrões de Ações

| Tipo de Ação      | Estilo                        | Exemplos                  |
|-------------------|-------------------------------|---------------------------|
| Ação primária     | `.btn-primary` (vermelho)     | Guardar, Upload, Enviar   |
| Ação secundária   | `.btn-secondary` (outline)    | Cancelar, Voltar          |
| Ação ghost        | `.btn-ghost` (transparente)   | ⚙️, 📁, Eliminar          |
| Ação destrutiva   | Cor `--color-state-error`     | Eliminar (texto vermelho) |

### Padrões de Feedback

- **Toasts**: Notificações temporárias (`success`, `error`, `info`) via `showToast()`.
- **Confirmação**: Modal com `showConfirm()` para ações destrutivas.
- **Loading states**: Texto "A carregar…" ou spinner inline.
- **Empty states**: Ícone + mensagem contextual + call-to-action.

### Padrões de Chat

| Elemento               | Implementação                                    |
|------------------------|--------------------------------------------------|
| Mensagem User          | `.chat-message.user` — fundo claro, alinhado à direita |
| Mensagem Assistant     | `.chat-message.assistant` — fundo branco, com markdown |
| Grounding badge        | `.grounding-badge` — acima das fontes            |
| Fontes                 | `.chat-sources` — tags clicáveis com tooltip preview |
| Suggested prompts      | `.chat-suggested-btn` — pills interativos        |
| Mode selector          | Cada tipo de chat tem a sua rota própria (sem dropdown) |
| Growth Assistants UI   | Layout edge-to-edge estilo ChatGPT: header fixo, barra de input fixa, scroll na página inteira e content type em grelha de cards |

### Estrutura de Ficheiros CSS

| Ficheiro                                    | Escopo                    |
|---------------------------------------------|---------------------------|
| `src/app/globals.css`                       | Variables globais, reset  |
| `src/app/(dashboard)/dashboard.css`         | Layout, sidebar, grupos, user profile card |
| `src/app/(dashboard)/dashboard-home.css`    | Dashboard home page      |
| `src/app/(dashboard)/documents/documents.css`| Documentos, pastas, modais |
| `src/components/chat/chat.css`              | Chat, grounding, fontes (componente partilhado) |
| `src/app/(dashboard)/search/search.css`     | Pesquisa, resultados      |
| `src/app/(dashboard)/classifications/...css`| Classificação, histórico  |
| `src/app/(dashboard)/settings/settings.css` | Página de definições de perfil |
| `src/app/backoffice/backoffice.css`         | Backoffice admin          |
| `src/app/login/login.css`                   | Auth pages                |
| `src/app/setup/setup.css`                   | Setup wizard              |
| `src/app/first-login/first-login.css`       | First-login page          |
| `src/components/ui-feedback.css`            | Toasts e modais globais   |
| `src/styles/md-content.css`                 | Estilos globais para conteúdo markdown IA (ver secção 27) |
| `src/components/VoiceRantBrief.css`         | Estilos do VoiceRantBrief |
| `src/components/WorkspaceSelector.css`      | Estilos do WorkspaceSelector |
| `src/app/(dashboard)/product/product.css`   | Product Assistant         |
| `src/app/(dashboard)/projects/projects.css` | Project Workspaces        |

---

## 11. Stack Tecnológica

### Frontend

| Tecnologia         | Uso                                          |
|--------------------|----------------------------------------------|
| **Next.js 16**     | Framework React com App Router               |
| **React 19**       | UI components                                |
| **TypeScript**     | Tipagem estática                             |
| **CSS Vanilla**    | Estilos sem framework (dashboard.css, etc.)  |
| **Inter (Google Fonts)** | Tipografia principal                   |

### Backend

| Tecnologia            | Uso                                       |
|-----------------------|-------------------------------------------|
| **Next.js API Routes**| Endpoints RESTful                         |
| **Prisma ORM**        | Acesso à BD PostgreSQL                    |
| **Supabase Auth**     | Autenticação (email + Google OAuth)       |
| **Supabase Storage**  | Armazenamento de ficheiros                |
| **OpenAI API**        | GPT-4o (OCR, Product/Marketing/Sales generation), GPT-4o-mini (chat, classificação, rewrite), text-embedding-3-small |

### Base de Dados

| Tabela                   | Descrição                              |
|--------------------------|----------------------------------------|
| `Company`                | Empresas (multi-tenant)                |
| `CompanyFeature`         | Feature flags por empresa              |
| `License`                | Licenças e planos                      |
| `User`                   | Utilizadores                           |
| `Document`               | Documentos carregados                  |
| `DocFolder`              | Pastas de documentos (hierárquicas)    |
| `DocumentEmbedding`      | Embeddings vetoriais para pesquisa     |
| `Conversation`           | Conversas do Chat IA (inclui `onboardingRole`) |
| `Message`                | Mensagens do Chat                      |
| `ClassificationType`     | Tipos de classificação definidos       |
| `ClassificationResult`   | Resultados de classificação            |
| `ClassificationHistory`  | Histórico de classificações (runs)     |
| `CompanyProfile`         | Perfil estruturado da empresa para contexto IA |
| `CompanyOnboardingGuide` | Guia de onboarding gerado por IA (1:1 com Company) |
| `AssistantQuestionLog`   | Log de perguntas do assistente (rastreio de gaps) |
| `KnowledgeGap`           | Lacunas de conhecimento detetadas      |
| `LeadSearchRun`          | Runs de pesquisa de leads              |
| `LeadResult`             | Resultados individuais de leads        |
| `LeadList`               | Listas curadas de leads                |
| `LeadListItem`           | Items individuais dentro de listas de leads |
| `MarketingGenerationRun` | Gerações de conteúdo marketing        |
| `MarketingDraft`         | Rascunhos de marketing                 |
| `SalesGenerationRun`     | Gerações de conteúdo de vendas        |
| `SalesDraft`             | Rascunhos de vendas                    |
| `CompanyOnboardingState` | Estado do wizard de setup por empresa  |
| `AIBrainProfile`         | Perfis de IA Brain por empresa/tipo    |
| `AIBrainVersion`         | Versões com snapshot de configuração   |
| `AIBrainOverride`        | Overrides field-level para herança     |
| `AIBrainTestRun`         | Testes de prompt com resposta guardada |
| `AIBrainTemplate`        | Templates de Brain (SYSTEM/PLAN/COMPANY) |
| `ProductGenerationRun` | Gerações do Product Assistant             |
| `ProductDraft`         | Rascunhos de produto                      |
| `Project`              | Projetos/workspaces de cliente            |
| `UseCase`                | Casos de uso (módulo reservado)        |
| `DiagnosticAssessment`   | Diagnósticos IA (módulo reservado)     |
| `GovernanceTemplate`     | Templates de governança (reservado)    |
| `Workflow` / `WorkflowRun`| Workflows de automação (reservado)    |
| `SupportTicket`          | Tickets de suporte (reservado)         |

### Variáveis de Ambiente Necessárias

| Variável                          | Obrigatória | Descrição                         |
|-----------------------------------|-------------|-----------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`        | ✅          | URL do projeto Supabase           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | ✅          | Chave anónima do Supabase         |
| `SUPABASE_SERVICE_ROLE_KEY`       | ✅          | Chave de serviço (server-side)    |
| `DATABASE_URL`                    | ✅          | Connection string PostgreSQL      |
| `DIRECT_URL`                      | ✅          | URL direta para Prisma            |
| `OPENAI_API_KEY`                  | ✅          | Chave da API OpenAI               |

---

## 12. Perfil da Empresa (Company Profile)

### Descrição

Camada de conhecimento estruturado sobre a empresa que complementa os documentos carregados. O Perfil da Empresa é injetado nos prompts do **Assistente da Empresa** e do **Assistente de Onboarding** para enriquecer as respostas com contexto institucional.

### Dados do Perfil

| Campo                | Tipo     | Descrição                                          |
|----------------------|----------|----------------------------------------------------||
| `companyName`        | String?  | Nome oficial da empresa                            |
| `industry`           | String?  | Setor de atividade                                 |
| `description`        | String?  | Descrição geral da empresa (`@db.Text`)            |
| `mission`            | String?  | Missão da empresa                                  |
| `vision`             | String?  | Visão da empresa                                   |
| `productsServices`   | String?  | Produtos e serviços principais (`@db.Text`)        |
| `targetMarket`       | String?  | Mercado alvo                                       |
| `keyDifferentiators` | String?  | Fatores diferenciadores face à concorrência        |
| `teamSize`           | String?  | Dimensão da equipa                                 |
| `foundedYear`        | String?  | Ano de fundação                                    |
| `headquarters`       | String?  | Localização da sede                                |
| `website`            | String?  | Website oficial                                    |

### Injeção no Contexto IA

- **Assistente da Empresa**: injetado para intents `COMPANY_OVERVIEW`, `PRODUCT`, `GENERAL`.
- **Assistente de Onboarding**: injetado sempre, combinado com o guia de onboarding.
- O perfil **complementa** (não substitui) a evidência documental.

### Página UI

- **Rota**: `/company/profile`
- Formulário com todos os campos do perfil.
- Guardar via `PUT /api/company/profile`.

### API Routes

| Endpoint                | Método | Descrição                              |
|-------------------------|--------|----------------------------------------|
| `/api/company/profile`  | GET    | Obter perfil da empresa atual          |
| `/api/company/profile`  | PUT    | Criar ou atualizar perfil da empresa   |

### Ficheiros

- `src/app/(dashboard)/company/profile/page.tsx`
- `src/app/api/company/profile/route.ts`

---

## 13. Assistente de Onboarding

### Descrição

Modo dedicado do Chat IA para integração de novos colaboradores. Utiliza o **Perfil da Empresa**, o **Guia de Onboarding** gerado por IA, e os documentos indexados para responder às perguntas mais comuns de quem acabou de entrar na empresa. Suporta personalização por **papel/função** do colaborador.

### Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Frontend — Onboarding Landing Panel (/chat)             │
│  - Mensagem de boas-vindas                               │
│  - Seletor de role: Geral / Vendas / Marketing /         │
│    Operações / Produto / Finanças / RH                   │
│  - Cartão do Resumo (Guia de Onboarding IA)              │
│  - Perguntas sugeridas (dinâmicas por role)              │
│  - Documentos Recomendados (clicáveis)                   │
└───────────────────────┬──────────────────────────────────┘
                        │ POST /api/chat { assistantType: ONBOARDING_ASSISTANT, onboardingRole }
                        ▼
┌──────────────────────────────────────────────────────────┐
│  API: src/app/api/chat/route.ts                          │
│  findRelevantOnboardingKnowledge():                      │
│    Stage 1: Embed + retrieval (threshold 0.15)           │
│    Stage 2: Metadata enrichment                          │
│    Stage 3: Onboarding category boosts + role boosts     │
│    Stage 4: Dedup + cap (max 8 chunks)                   │
│  + Injeção de CompanyProfile + CompanyOnboardingGuide    │
│  + System prompt de onboarding (acolhedor, pedagógico)   │
└──────────────────────────────────────────────────────────┘
```

### Boosts de Onboarding

| Categoria    | Base Boost | Notas                                 |
|--------------|------------|---------------------------------------|
| `onboarding` | +0.25      | Maior prioridade                      |
| `company`    | +0.20      | Contexto institucional                |
| `process`    | +0.18      | Processos internos                    |
| `product`    | +0.15      | Produtos e serviços                   |
| `hr`         | +0.12      | RH e benefícios                       |
| `policy`     | +0.10      | Políticas                             |
| `operations` | +0.08      | Operações                             |

Em adição, cada **role** tem boosts extra por categoria:

| Role        | Boosts Adicionais                   |
|-------------|-------------------------------------|
| sales       | product +0.10, company +0.08        |
| operations  | process +0.12, operations +0.10     |
| hr          | hr +0.15, policy +0.12              |
| product     | product +0.12, company +0.08        |
| marketing   | company +0.10, product +0.08        |
| finance     | finance +0.12, operations +0.08     |

### Guia de Onboarding (CompanyOnboardingGuide)

| Campo                 | Tipo     | Descrição                                          |
|-----------------------|----------|----------------------------------------------------||
| `companyId`           | String   | FK para `Company` (1:1)                            |
| `summary`             | String   | Resumo gerado por IA (`@db.Text`)                  |
| `recommendedDocIds`   | Json?    | IDs dos documentos recomendados para onboarding    |
| `generatedFromProfile`| Boolean  | Indica se foi gerado com perfil da empresa         |
| `generatedAt`         | DateTime | Timestamp de geração                               |

### Landing Panel vs Chat Ativo

- **Sem mensagens**: Mostra o painel de boas-vindas completo (role selector, guia, prompts, docs).
- **Com mensagens**: Barra compacta de role pills acima das mensagens para trocar de role mid-conversation.
- **Perfil de role** é passado ao backend em cada pedido e guardado na `Conversation.onboardingRole`.

### API Routes

| Endpoint                                  | Método | Descrição                                              |
|-------------------------------------------|--------|--------------------------------------------------------|
| `/api/chat`                               | POST   | Chat com `assistantType: ONBOARDING_ASSISTANT`         |
| `/api/company/onboarding-guide`           | GET    | Obter guia de onboarding existente                     |
| `/api/company/onboarding-guide/generate`  | POST   | Gerar/regenerar guia via IA (GPT-4o-mini)              |

### Ficheiros

- `src/app/(dashboard)/chat/page.tsx` — Landing panel + chat UI
- `src/app/(dashboard)/chat/chat.css` — Estilos do onboarding panel
- `src/app/api/company/onboarding-guide/route.ts`
- `src/app/api/company/onboarding-guide/generate/route.ts`

---

## 14. Deteção de Lacunas de Conhecimento

### Descrição

Sistema que monitoriza automaticamente quando o assistente não consegue responder com base nos documentos disponíveis. Agrupa perguntas semelhantes, identifica os tópicos em falta, e gera recomendações de documentação para os administradores.

### Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  POST /api/chat                                          │
│  → Logging fire-and-forget → AssistantQuestionLog        │
│    (apenas para COMPANY_KNOWLEDGE e ONBOARDING_ASSISTANT)│
└───────────────────────┬──────────────────────────────────┘
                        │ (acumula logs)
                        ▼
┌──────────────────────────────────────────────────────────┐
│  POST /api/knowledge-gaps/analyze                        │
│  1. Busca logs NOT_FOUND/PARTIAL últimos 30 dias         │
│  2. Deduplica perguntas exatas                           │
│  3. Gera embeddings (text-embedding-3-small)             │
│  4. Clustering greedy por cosine similarity (≥ 0.72)     │
│  5. Por cluster com ≥ 2 perguntas:                       │
│     → GPT-4o-mini: gera tópico (3-6 palavras)            │
│     → GPT-4o-mini: gera recomendação em pt-PT            │
│     → Calcula score e upsert em KnowledgeGap             │
│  6. Auto-resolução: gaps com ≥70% VERIFIED → resolved    │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│  Frontend: /knowledge-gaps                               │
│  - Barra de estatísticas (total / abertos / resolvidos)  │
│  - Filtros por estado                                    │
│  - Tabela: tópico, exemplos, frequência, taxa de falha   │
│  - Modal de detalhe: todas as perguntas + recomendação   │
│  - Ações: Resolver / Ignorar / Reabrir                   │
└──────────────────────────────────────────────────────────┘
```

### Fórmula de Scoring

```
gapScore = (min(frequency, 20) / 20) × 0.4
         + groundingFailureRate × 0.4
         + recencyBoost × 0.2
```

- **frequência**: nº de perguntas similares (normalizado a 20 max)
- **groundingFailureRate**: % de respostas NOT_FOUND no cluster (0.0 – 1.0)
- **recencyBoost**: `max(0, 1 - diasDesdeÚltimaPergunta / 30)`

### Modelo de Dados

**AssistantQuestionLog**:
| Campo            | Tipo     | Descrição                                          |
|------------------|----------|----------------------------------------------------||
| `companyId`      | String   | Isolamento multi-tenant                            |
| `conversationId` | String?  | FK para `Conversation`                             |
| `userId`         | String   | FK para `User`                                     |
| `question`       | String   | Texto da pergunta                                  |
| `assistantType`  | String   | Tipo de assistente                                 |
| `groundingStatus`| String   | `VERIFIED`, `PARTIAL`, `NOT_FOUND`, `GENERAL`      |

**KnowledgeGap**:
| Campo              | Tipo     | Descrição                                        |
|--------------------|----------|--------------------------------------------------|
| `topic`            | String   | Tópico gerado por IA (3-6 palavras)              |
| `exampleQuestions` | Json     | Array de perguntas de exemplo                   |
| `suggestion`       | String?  | Recomendação de documentação em pt-PT            |
| `frequency`        | Int      | Nº total de perguntas no cluster                 |
| `groundingRate`    | Float    | Taxa de falha (1.0 = 100% NOT_FOUND)             |
| `score`            | Float    | Score de urgência                                |
| `status`           | String   | `open` / `resolved` / `ignored`                  |
| `lastSeenAt`       | DateTime | Timestamp da pergunta mais recente               |

### Auto-Resolução

Em cada execução de `/api/knowledge-gaps/analyze`:
1. Para cada gap `open`, pesquisa perguntas recentes com a palavra-chave do tópico.
2. Se ≥ 70% das respostas recentes são `VERIFIED` → status atualizado para `resolved` automaticamente.
3. Típico trigger: admin carrega documento → questions passam a retornar `VERIFIED`.

### API Routes

| Endpoint                         | Método | Descrição                                            |
|----------------------------------|--------|------------------------------------------------------|
| `/api/knowledge-gaps`            | GET    | Listar gaps da empresa, ordenados por score          |
| `/api/knowledge-gaps/analyze`    | POST   | Executar análise completa (clustering + AI + upsert) |
| `/api/knowledge-gaps/[id]`       | PATCH  | Atualizar status (`open`, `resolved`, `ignored`)     |

### Ficheiros

- `src/app/(dashboard)/knowledge-gaps/page.tsx` — Dashboard admin
- `src/app/(dashboard)/knowledge-gaps/knowledge-gaps.css` — Estilos
- `src/app/api/knowledge-gaps/route.ts`
- `src/app/api/knowledge-gaps/analyze/route.ts`
- `src/app/api/knowledge-gaps/[id]/route.ts`
- `src/app/api/chat/route.ts` — Logging integrado (fire-and-forget)

---

## 15. Definições do Perfil de Utilizador

### Descrição

Página dedicada para que cada utilizador gira as suas informações pessoais, preferências e dados de conta. Acessível via `/settings` ou clicando no **User Profile Card** na sidebar.

### Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Frontend: src/app/(dashboard)/settings/page.tsx         │
│                                                          │
│  Secção 1 — Avatar                                       │
│    - Foto de perfil com upload de ficheiro               │
│    - Fallback: placeholder com iniciais (gradiente red)  │
│    - Botões: "Alterar foto" / "Remover"                  │
│                                                          │
│  Secção 2 — Informação Pessoal                           │
│    - Nome Completo (editável)                            │
│    - Email (read-only — identificador de autenticação)   │
│                                                          │
│  Secção 3 — Preferências                                 │
│    - Idioma: PT / EN / ES / FR                           │
│    - Fuso Horário: seletor com opções multilíngues       │
│                                                          │
│  Secção 4 — Conta                                        │
│    - Badge de função (Membro / Administrador / SuperAdmin)│
│    - Data de "Membro desde"                              │
└───────────────────────┬──────────────────────────────────┘
                        │ GET /api/user/profile
                        │ PUT /api/user/profile
                        ▼
┌──────────────────────────────────────────────────────────┐
│  API: src/app/api/user/profile/route.ts                  │
│  GET  → devolve { id, name, email, avatarUrl, timezone, role, createdAt } │
│  PUT  → atualiza name, timezone, avatarUrl               │
└──────────────────────────────────────────────────────────┘
```

### Sidebar — User Profile Card

O rodapé da sidebar exibe automaticamente o perfil do utilizador autenticado:

```
┌──────────────────────────┐
│  [Avatar] Nome            │  ← Link para /settings
│           email@...       │
│ [🚪 Sair]                │
└──────────────────────────┘
```

- **Avatar**: imagem de perfil ou placeholder com iniciais num gradiente vermelho.
- **Nome e email**: truncados com `text-overflow: ellipsis` se necessário.
- **Hover**: fundo `var(--color-bg-surface)` com transição suave.
- **Clicar**: navega para `/settings`.
- Dados carregados via `GET /api/user/profile` no `useEffect` do `DashboardLayout`.

### Modelo de Dados — User (campos relevantes)

| Campo       | Tipo     | Descrição                                     |
|-------------|----------|-----------------------------------------------|
| `name`      | String   | Nome completo (editável pelo utilizador)       |
| `email`     | String   | Email de autenticação (read-only)              |
| `avatarUrl` | String?  | URL da foto de perfil (opcional)               |
| `timezone`  | String   | Fuso horário (default: `Europe/Lisbon`)        |
| `role`      | UserRole | `MEMBER`, `ADMIN`, ou `SUPER_ADMIN`            |
| `createdAt` | DateTime | Data de criação da conta                       |

### API Routes

| Endpoint              | Método | Descrição                                              |
|-----------------------|--------|--------------------------------------------------------|
| `/api/user/profile`   | GET    | Obter perfil do utilizador autenticado                 |
| `/api/user/profile`   | PUT    | Atualizar name, avatarUrl, timezone                    |

**PUT Body**:
```json
{ "name": "João Silva", "timezone": "Europe/Lisbon", "avatarUrl": null }
```
- `email` e `role` são **read-only** por esta API — alterações requerem acesso ao backoffice.
- `avatarUrl: null` remove a foto de perfil.

### UX/UI — Requisitos

- **Layout**: Coluna única, `max-width: 720px`, centrada no conteúdo.
- **Cards**: Cada secção agrupa campos num card `settings-card` com título e ícone.
- **Botões de guardar**: presente no header e no rodapé da página (dupla confirmação).
- **Campos read-only**: `input:read-only` com fundo `var(--color-bg-surface)` e cursor desativado.
- **Toast de feedback**: `showToast('Perfil atualizado com sucesso!', 'success')` após `PUT` com sucesso.
- **Ficheiros de estilos**: `src/app/(dashboard)/settings/settings.css`

### Ficheiros

- `src/app/(dashboard)/settings/page.tsx` — Página de definições
- `src/app/(dashboard)/settings/settings.css` — Estilos da página
- `src/app/api/user/profile/route.ts` — API GET/PUT
- `src/app/(dashboard)/layout.tsx` — User Profile Card no rodapé da sidebar
- `src/app/(dashboard)/dashboard.css` — Estilos do User Profile Card

---

## 16. AI Lead Discovery

### Descrição

Ferramenta de prospeção assistida por IA que pesquisa potenciais clientes com base numa query em linguagem natural. Gera fichas detalhadas de leads com scoring de relevância, abordagens sugeridas e possibilidade de organização em listas.

### Rota

`/leads` — acessível com feature flag `leads` ativa.

### Funcionalidades

- **Pesquisa de leads** via query em linguagem natural (ex: "PMEs de logística em Portugal que precisam de digitalização").
- **Resultados** com: nome da empresa, website, indústria, localização, resumo, porquê é um bom fit, abordagem sugerida, cargos de contacto sugeridos e links de fontes.
- **Lead Lists**: Criação e gestão de listas de leads curadas (salvar runs, adicionar/remover leads).
- **Score de relevância**: Cada lead tem um `relevanceScore` (0–1).
- **Status por lead**: `active`, `archived`, etc.

### Modelo de Dados

**LeadSearchRun**:
| Campo           | Tipo     | Descrição                              |
|-----------------|----------|----------------------------------------|
| `companyId`     | String   | FK para `Company`                      |
| `userId`        | String   | FK para `User`                         |
| `title`         | String?  | Título do run (opcional)               |
| `query`         | String   | Query de pesquisa em linguagem natural |
| `searchContext` | Json?    | Contexto adicional de pesquisa         |
| `status`        | String   | `running` / `completed` / `failed`     |

**LeadResult**:
| Campo                | Tipo    | Descrição                               |
|----------------------|---------|-----------------------------------------|
| `companyName`        | String  | Nome da empresa lead                    |
| `website`            | String? | Website da empresa                      |
| `industry`           | String? | Indústria                               |
| `location`           | String? | Localização                             |
| `summary`            | String? | Resumo da empresa                       |
| `whyFit`             | String? | Justificação do fit                     |
| `suggestedApproach`  | String? | Abordagem de vendas sugerida            |
| `likelyContactRoles` | Json?   | Cargos de contacto sugeridos            |
| `sourceLinks`        | Json?   | Links das fontes                        |
| `relevanceScore`     | Float?  | Score de relevância (0-1)               |

### Ficheiros

- `src/app/(dashboard)/leads/page.tsx`
- `src/app/api/leads/route.ts` e sub-rotas

---

## 17. AI Marketing Assistant

### Descrição

Assistente de geração de conteúdo de marketing com IA. Permite criar vários tipos de conteúdo (posts, emails, artigos, etc.) ajustados ao tom, idioma e audiência da empresa, com histórico de gerações e gestão de rascunhos.

### Rota

`/marketing` — acessível com feature flag `marketing` ativa.

### Funcionalidades

- **Tab "Criar"**: Formulário com tipo de conteúdo, audiência, tom, idioma e prompt de entrada. Geração via IA com output de texto formatado (renderizado com `ReactMarkdown` + classe `md-content`).
- **Geração de Imagens com IA**: Para `LinkedIn Post` e `Blog / Artigo`, existe a opção (checkbox) de gerar imagens super-realísticas (DALL-E 3, *style: natural*) baseadas na audiência e sumário de conteúdo. Download de imagem disponível diretamente no UI.
- **RAG Automático**: Antes de gerar, o sistema pesquisa automaticamente a base de documentos embeddada da empresa via `retrieveRelevantKnowledge()` para enriquecer o prompt com conhecimento real da empresa.
- **Tab "Rascunhos"**: Lista de drafts guardados com opções de editar, copiar e eliminar.
- **Tab "Histórico"**: Registos de todas as gerações anteriores.

### Modelo de Dados

**MarketingGenerationRun** (geração):
| Campo          | Tipo     | Descrição                             |
|----------------|----------|---------------------------------------|
| `contentType`  | String   | Tipo: `post`, `email`, `article`, etc. |
| `inputPrompt`  | String   | Prompt de entrada do utilizador       |
| `outputText`   | String?  | Conteúdo gerado pela IA               |
| `language`     | String?  | Idioma do conteúdo                    |
| `tone`         | String?  | Tom: profissional, direto, etc.       |
| `audience`     | String?  | Audiência alvo                        |

**MarketingDraft** (rascunho guardado):
| Campo         | Tipo   | Descrição                         |
|---------------|--------|-----------------------------------|
| `contentType` | String | Tipo de conteúdo                  |
| `title`       | String | Título do rascunho                |
| `content`     | String | Conteúdo completo (`@db.Text`)    |
| `metadata`    | Json?  | Metadados (tom, idioma, audiência)|

### Ficheiros

- `src/app/(dashboard)/marketing/page.tsx`
- `src/app/api/marketing/route.ts` e sub-rotas

---

## 18. AI Sales Assistant

### Descrição

Assistente de geração de conteúdo de vendas com IA. Permite criar emails de prospeção, propostas, follow-ups e outros materiais de vendas personalizados ao comprador/empresa alvo, com integração opcional com leads do AI Lead Discovery.

### Rota

`/sales` — acessível com feature flag `sales` ativa.

### Funcionalidades

- **Tab "Criar"**: Seleção de tipo de tarefa de vendas (email de prospeção, proposta, follow-up, etc.), nome da empresa-alvo, cargo do comprador, idioma, tom e prompt. Geração via IA (renderizada com `ReactMarkdown` + classe `md-content`).
- **RAG Automático**: Busca automática de conhecimento relevante na base de documentos embeddada antes de gerar.
- **Tab "Rascunhos"**: Lista de drafts de vendas guardados.
- **Tab "Histórico"**: Registos de todas as gerações anteriores com filtros por tipo de tarefa.
- **Integração com Leads**: Opção de gerar conteúdo de vendas diretamente a partir de um `LeadResult` existente.

### Modelo de Dados

**SalesGenerationRun** (geração):
| Campo                 | Tipo     | Descrição                              |
|-----------------------|----------|----------------------------------------|
| `taskType`            | String   | Tipo: `prospecting_email`, `proposal`, `follow_up`, etc. |
| `inputPrompt`         | String   | Prompt de entrada                      |
| `outputText`          | String?  | Conteúdo gerado pela IA                |
| `language`            | String?  | Idioma                                 |
| `tone`                | String?  | Tom                                    |
| `buyerRole`           | String?  | Cargo do comprador                     |
| `prospectCompanyName` | String?  | Nome da empresa-alvo                   |
| `sourceLeadResultId`  | String?  | FK para `LeadResult` (opcional)        |

**SalesDraft** (rascunho guardado):
| Campo     | Tipo   | Descrição                            |
|-----------|--------|--------------------------------------|
| `taskType`| String | Tipo de tarefa de vendas             |
| `title`   | String | Título do rascunho                   |
| `content` | String | Conteúdo completo (`@db.Text`)       |
| `metadata`| Json?  | Metadados (tom, idioma, buyer, etc.) |

### Ficheiros

- `src/app/(dashboard)/sales/page.tsx`
- `src/app/api/sales/route.ts` e sub-rotas

---

## 19. Dashboard Home

### Descrição

Página principal do dashboard (`/dashboard`) que apresenta ao utilizador uma visão geral da sua empresa, incluindo métricas, saúde do conhecimento, ações rápidas e atividade recente.

### Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Frontend: src/app/(dashboard)/dashboard/page.tsx         │
│                                                          │
│  Secção 1 — Hero                                         │
│    - Saudação personalizada: "Welcome back, {nome}!"     │
│    - Nome da empresa (via /api/company/profile)          │
│    - Botões CTA: "Ask AI" e "Upload Docs"                │
│                                                          │
│  Secção 2 — Setup Prompts (condicionais)                 │
│    - Se !hasCompanyProfile → link para /company/profile  │
│    - Se !hasOnboardingGuide → link para /chat?mode=onb.  │
│                                                          │
│  Secção 3 — Quick Actions                                │
│    - Cards: Upload Docs, Ask AI, Search Knowledge, Onb.  │
│    - Filtrados por feature flags                         │
│                                                          │
│  Secção 4 — Métricas (4 cards)                           │
│    - Total documentos, OCR processados, fontes curadas,  │
│      conversas IA                                        │
│                                                          │
│  Secção 5 — Knowledge Health (barras de progresso)       │
│    - OCR Processing %, Knowledge Insights (gaps abertos),│
│      Curated Sources %                                   │
│                                                          │
│  Secção 6 — Atividade Recente (2 colunas)                │
│    - Documentos recentes (últimos 5)                     │
│    - Conversas recentes (últimas 5)                      │
└───────────────────────┬──────────────────────────────────┘
                        │ GET /api/analytics
                        │ GET /api/user/features
                        │ GET /api/user/profile
                        │ GET /api/company/profile
                        ▼
┌──────────────────────────────────────────────────────────┐
│  API: src/app/api/analytics/route.ts                     │
│  Retorna: overview (docs, ocr, curated, convs, gaps),    │
│  status (hasCompanyProfile, hasOnboardingGuide),          │
│  recent (5 docs, 5 conversas)                            │
└──────────────────────────────────────────────────────────┘
```

### API Route — Analytics

**`GET /api/analytics`**: Retorna estatísticas do dashboard para a empresa do utilizador autenticado.

**Resposta**:
```json
{
  "overview": {
    "documents": 42,
    "ocrProcessed": 38,
    "curatedSources": 5,
    "conversations": 12,
    "classifications": 8,
    "openKnowledgeGaps": 3,
    "ocrRate": 90
  },
  "status": {
    "hasCompanyProfile": true,
    "hasOnboardingGuide": false
  },
  "recent": {
    "documents": [...],
    "conversations": [...]
  }
}
```

### Ficheiros

- `src/app/(dashboard)/dashboard/page.tsx` — Página do dashboard
- `src/app/(dashboard)/dashboard-home.css` — Estilos do dashboard home
- `src/app/api/analytics/route.ts` — API de analytics por empresa

---

## 20. Internacionalização (i18n)

### Descrição

Sistema de internacionalização que permite a tradução da interface do utilizador em múltiplos idiomas. O idioma é definido ao nível da empresa (no backoffice durante a criação) e propagado a todos os utilizadores.

### Idiomas Suportados

| Locale  | Idioma      | Ficheiro           |
|---------|-------------|--------------------|
| `en`    | English     | `src/i18n/en.json` |
| `pt-PT` | Português   | `src/i18n/pt-PT.json` |
| `fr`    | Français    | `src/i18n/fr.json` |

**Default**: `en` (English).

### Arquitetura

```
┌───────────────────────────────────────────────────────┐
│  LanguageProvider (src/i18n/context.tsx)                │
│  - Wraps o DashboardLayout                            │
│  - Fetch /api/user/language ao montar                 │
│  - Expõe hook useT() → { locale, t() }               │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│  t(key, params?)                                       │
│  - Lookup: translations[locale][section][subKey]       │
│  - Fallback: translations['en'][section][subKey]       │
│  - Interpolação: {name} → params.name                 │
│  - Exemplo: t('dashboard.welcomeBack', { name: 'J' }) │
└───────────────────────────────────────────────────────┘
```

### Uso no Código

**Dashboard (dentro de `LanguageProvider`)**:
```tsx
const { t } = useT();
<h1>{t('dashboard.welcomeBack', { name: firstName })}</h1>
```

**Backoffice / Setup (sem provider)**:
```tsx
import { t, DEFAULT_LOCALE } from '@/i18n';
const lang = DEFAULT_LOCALE;
<h2>{t(lang, 'backoffice.companyManagement')}</h2>
```

### API Routes

| Endpoint              | Método | Descrição                                            |
|-----------------------|--------|------------------------------------------------------|
| `/api/user/language`  | GET    | Retorna o idioma da empresa do utilizador autenticado |

### Ficheiros

- `src/i18n/index.ts` — Funções `t()`, `getLanguageName()`, `getAiLanguageName()`, constantes
- `src/i18n/context.tsx` — `LanguageProvider` e hook `useT()`
- `src/i18n/en.json` — Traduções em Inglês
- `src/i18n/pt-PT.json` — Traduções em Português
- `src/i18n/fr.json` — Traduções em Francês

---

## 21. Setup Wizard e First-Login

### Descrição

Fluxo de onboarding guiado para novos utilizadores e empresas. Composto por duas partes: (1) **First-Login** para utilizadores que precisam alterar a password temporária, e (2) **Setup Wizard** com 6 passos para configurar a empresa.

### Fluxo de Gating

```
Login → Layout verifica /api/user/onboarding-status
  │
  ├─ mustChangePassword = true → /first-login
  │    └─ POST /api/auth/complete-first-login → /setup
  │
  ├─ onboardingStatus ≠ COMPLETED → /setup
  │    └─ 6 passos → POST /api/onboarding/complete → /dashboard
  │
  └─ tudo OK → /dashboard
```

### First-Login (`/first-login`)

- Página para alterar a password temporária (criada pelo admin no backoffice).
- Validação: mínimo 8 caracteres, confirmação de password.
- Após sucesso: redireciona para `/setup`.

### Setup Wizard (`/setup`)

Wizard de 6 passos com barra de progresso visual e estado persistido (via API):

| Passo | Título                  | Conteúdo                                           |
|-------|-------------------------|----------------------------------------------------|
| 1     | Boas-vindas             | Mensagem de boas-vindas, resumo do que será configurado |
| 2     | Perfil da Empresa       | Nome, indústria, website, ano, descrição, produtos, proposta de valor |
| 3     | Contexto de Negócio     | Clientes alvo, indústrias, mercados, processos, departamentos, ferramentas, concorrentes, objetivos, tom de marca |
| 4     | Upload de Documentos    | Upload de ficheiros (drag & drop ou clique), com estado por ficheiro |
| 5     | Revisão e Guia          | Resumo do perfil + docs, geração do guia de onboarding via IA |
| 6     | Conclusão               | Atalhos para Chat, Perfil da Empresa, Documentos, Onboarding Assistant |

**Persistência de Estado**: O passo atual e os passos concluídos são guardados via `PUT /api/onboarding/state`, permitindo retomar o wizard em caso de interrupção.

### API Routes

| Endpoint                        | Método | Descrição                                        |
|---------------------------------|--------|--------------------------------------------------|
| `/api/user/onboarding-status`   | GET    | Verifica se precisa mudar password / completar setup |
| `/api/auth/complete-first-login`| POST   | Altera password temporária                       |
| `/api/onboarding/state`         | GET    | Obter estado atual do wizard                     |
| `/api/onboarding/state`         | PUT    | Guardar estado do wizard (passo, passos completos) |
| `/api/onboarding/complete`      | POST   | Marcar onboarding como concluído                 |

### Ficheiros

- `src/app/first-login/page.tsx` — Página de alteração de password
- `src/app/first-login/first-login.css` — Estilos
- `src/app/setup/page.tsx` — Setup wizard de 6 passos
- `src/app/setup/layout.tsx` — Layout do setup (sem sidebar)
- `src/app/setup/setup.css` — Estilos do wizard

---

## 22. SmartInput — Voz e Reescrita IA

### Descrição

Componente reutilizável que adiciona capacidades de **Speech-to-Text** (ditado por voz) e **Reescrita com IA** a qualquer campo de input da aplicação. Utilizado nas páginas de Lead Discovery, Marketing Assistant e Sales Assistant.

### Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  SmartInput Component (src/components/SmartInput.tsx)      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  <input> ou <textarea> (campo principal)           │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌─────────┐  ┌─────────┐                                │
│  │ 🎙️ Voz  │  │ ✨ IA   │  ← Botões de ação              │
│  └────┬────┘  └────┬────┘                                │
│       │            │                                     │
│       ▼            ▼                                     │
│  Web Speech API   POST /api/ai/rewrite                   │
│  (browser-native)  { text, fieldLabel, brainType }       │
└──────────────────────────────────────────────────────────┘
```

### Props

| Prop          | Tipo                     | Descrição                                       |
|---------------|--------------------------|--------------------------------------------------|
| `value`       | `string`                 | Valor atual do campo (controlled)                |
| `onChange`    | `(value: string) => void`| Callback quando o valor muda                    |
| `placeholder` | `string?`                | Texto placeholder                                |
| `rows`        | `number?`                | Número de linhas (textarea), default: 2          |
| `multiline`   | `boolean?`               | Se `true`, renderiza `<textarea>` em vez de `<input>` |
| `brainType`   | `string`                 | Tipo de AI Brain para contexto da reescrita      |
| `fieldLabel`  | `string`                 | Label do campo (informado ao prompt de reescrita)|
| `id`          | `string?`                | ID do elemento HTML                              |
| `required`    | `boolean?`               | Campo obrigatório                                |
| `disabled`    | `boolean?`               | Campo desativado                                 |
| `className`   | `string?`                | Classes CSS adicionais                           |

### Speech-to-Text (Voz)

- **API**: Web Speech API nativa do browser (`SpeechRecognition` / `webkitSpeechRecognition`).
- **Idioma**: `en-US` (hardcoded).
- **Modo**: `interimResults: true`, `continuous: false` — mostra resultados enquanto fala.
- **Comportamento**: O texto ditado é **concatenado** ao conteúdo existente (não substitui).
- **Estado visual**: Botão muda de 🎙️ para ⏹️ durante gravação, com classe `.recording`.
- **Fallback**: Alerta se o browser não suportar a API.

### Reescrita com IA

- **Endpoint**: `POST /api/ai/rewrite`.
- **Requisitos**: Campo deve ter conteúdo (botão desativado se vazio).
- **Contexto**: Envia `text`, `fieldLabel` e `brainType` ao backend.
- **Backend**:
  1. Resolve o `AIBrainProfile` efetivo para o `brainType` via `resolveEffectiveBrainConfig()`.
  2. Constrói system prompt com `buildBrainSystemPrompt()` usando a configuração do Brain.
  3. Chama `gpt-4o-mini` com temperatura ligeiramente mais alta (`+0.1` para criatividade).
  4. Retorna texto reescrito no idioma da empresa.
- **Estado visual**: Botão mostra ⏳ durante processamento, com classe `.rewriting`.
- **Erro**: Falha silenciosa — campo mantém o valor original.

### Páginas que Utilizam o SmartInput

| Página               | Rota         | Campos com SmartInput                         |
|----------------------|--------------|-----------------------------------------------|
| Lead Discovery       | `/leads`     | Query de pesquisa de leads                    |
| Marketing Assistant  | `/marketing` | Prompt de geração de conteúdo                 |
| Sales Assistant      | `/sales`     | Prompt de geração de conteúdo de vendas       |

### API Route — Reescrita

| Endpoint           | Método | Descrição                                              |
|--------------------|--------|--------------------------------------------------------|
| `/api/ai/rewrite`  | POST   | Reescreve texto usando config do AI Brain ativo        |

**Request**:
```json
{ "text": "...", "fieldLabel": "Search query", "brainType": "LEAD_DISCOVERY" }
```

**Response**:
```json
{ "rewritten": "..." }
```

### Ficheiros

- `src/components/SmartInput.tsx` — Componente reutilizável
- `src/components/SmartInput.css` — Estilos (wrapper, ações, estados)
- `src/app/api/ai/rewrite/route.ts` — API de reescrita com integração AI Brain

---

## 23. AI Brain Profiles

### Descrição

Sistema de configuração avançada do comportamento dos assistentes IA. Permite personalizar a identidade, raciocínio, conhecimento, comportamento em tarefas, guardrails e delegação de cada tipo de assistente, com herança hierárquica, versionamento, templates e testes integrados.

### Conceitos Chave

- **Brain Profile**: Configuração completa de um assistente IA para uma empresa.
- **Brain Type**: Cada empresa pode ter **um Brain por tipo** (constraint `@@unique([companyId, brainType])`).
- **Herança**: Brains de role (ex: `SALES`) herdam do Brain `COMPANY` da mesma empresa, com overrides field-level.
- **Versões**: Cada alteração pode ser publicada como nova versão com snapshot completo.
- **Templates**: Configurações pré-definidas (SYSTEM, PLAN, COMPANY) para inicialização rápida.
- **Testes**: Prompt de teste com resposta guardada para validação antes de publicar.

### Tipos de Brain

| Brain Type         | Assistente Associado             | Descrição                            |
|--------------------|----------------------------------|--------------------------------------|
| `COMPANY`          | (base para todos)                | Personalidade base da empresa        |
| `COMPANY_ADVISOR`  | Assistente da Empresa            | Consultor de conhecimento interno    |
| `SALES`            | Sales Assistant                  | Geração de conteúdo de vendas        |
| `MARKETING`        | Marketing Assistant              | Geração de conteúdo marketing        |
| `ONBOARDING`       | Assistente de Onboarding         | Integração de novos colaboradores    |
| `LEAD_DISCOVERY`   | Lead Discovery                   | Prospeção de leads                   |

### Esquema de Configuração (`BrainConfig`)

A configuração é organizada em **6 domínios**:

#### Identity (Identidade)

| Campo                 | Tipo     | Range  | Descrição                              |
|-----------------------|----------|--------|----------------------------------------|
| `tonePreset`          | String   | Enum   | Tom pré-definido (7 opções)            |
| `formality`           | Number   | 0–10   | Nível de formalidade                   |
| `warmth`              | Number   | 0–10   | Empatia e calor nas respostas          |
| `assertiveness`       | Number   | 0–10   | Assertividade nas recomendações        |
| `creativity`          | Number   | 0–10   | Criatividade e originalidade           |
| `humor`               | Number   | 0–10   | Nível de humor                         |
| `brandStrictness`     | Number   | 0–10   | Rigor no tom de marca                  |
| `communicationStyle`  | String   | Enum   | Estilo (structured, conversational, concise, ...) |
| `languagePreference`  | String   | —      | `auto` ou código de locale             |

**Tone Presets**: `professional_consultative`, `friendly_approachable`, `formal_corporate`, `warm_supportive`, `direct_efficient`, `creative_expressive`, `authoritative_expert`.

**Communication Styles**: `structured`, `conversational`, `concise`, `consultative`, `executive`, `educational`.

#### Reasoning (Raciocínio)

| Campo                    | Tipo    | Range  | Descrição                              |
|--------------------------|---------|--------|----------------------------------------|
| `depth`                  | Number  | 0–10   | Profundidade da análise                |
| `speedVsThoroughness`    | Number  | 0–10   | Equilíbrio velocidade/rigor            |
| `proactiveness`          | Number  | 0–10   | Proatividade em sugestões              |
| `challengeLevel`         | Number  | 0–10   | Grau de desafio às premissas           |
| `analyticalStyle`        | Number  | 0–10   | Estilo analítico vs intuitivo          |
| `recommendationStrength` | Number  | 0–10   | Força das recomendações                |
| `askWhenUncertain`       | Boolean | —      | Perguntar quando incerto               |
| `provideOptions`         | Boolean | —      | Oferecer opções alternativas           |
| `explainReasoning`       | Boolean | —      | Explicar o raciocínio                  |
| `useStructuredResponses` | Boolean | —      | Usar respostas estruturadas            |
| `bestEffortBias`         | String  | Enum   | `best_effort`, `clarification_first`, `balanced` |

#### Knowledge (Conhecimento)

| Campo                                   | Tipo    | Range  | Descrição                              |
|-----------------------------------------|---------|--------|----------------------------------------|
| `preferInternalSources`                 | Boolean | —      | Preferir fontes internas               |
| `preferCuratedSources`                  | Boolean | —      | Preferir fontes curadas                |
| `useCompanyProfile`                     | Boolean | —      | Usar perfil da empresa                 |
| `recencySensitivity`                    | Number  | 0–10   | Sensibilidade à recência               |
| `sourceStrictness`                      | Number  | 0–10   | Rigor nas fontes                       |
| `citationStrictness`                    | Number  | 0–10   | Frequência de citações                 |
| `allowPartialAnswers`                   | Boolean | —      | Permitir respostas parciais            |
| `requireGroundingForSensitiveTopics`    | Boolean | —      | Exigir grounding para temas sensíveis  |
| `answerOnlyWhenGrounded`                | Boolean | —      | Responder apenas com evidência         |
| `useExternalSearchWhenWeak`             | Boolean | —      | Pesquisa externa quando fraco          |
| `answerConfidenceThreshold`             | Number  | 0–1    | Threshold de confiança para responder  |
| `escalationConfidenceThreshold`         | Number  | 0–1    | Threshold para escalação               |

#### Task Behavior (Comportamento em Tarefas)

| Campo               | Tipo   | Range | Descrição                              |
|---------------------|--------|-------|----------------------------------------|
| `detailLevel`       | Number | 0–10  | Nível de detalhe nas respostas         |
| `actionOrientation` | Number | 0–10  | Foco em ações concretas                |
| `persuasion`        | Number | 0–10  | Nível de persuasão                     |
| `educationalStyle`  | Number | 0–10  | Estilo educativo vs direto             |
| `verbosity`         | String | Enum  | `brief`, `medium`, `detailed`          |
| `summaryStyle`      | String | Enum  | `structured`, `narrative`, `bullet_points` |

#### Guardrails (Proteções)

| Campo                                    | Tipo     | Descrição                              |
|------------------------------------------|----------|----------------------------------------|
| `avoidInventingData`                     | Boolean  | Evitar inventar dados                  |
| `flagUncertainty`                        | Boolean  | Sinalizar incerteza                    |
| `avoidLegalAdvice`                       | Boolean  | Evitar aconselhamento legal            |
| `avoidFinancialAdvice`                   | Boolean  | Evitar aconselhamento financeiro       |
| `avoidHrSensitiveAssumptions`            | Boolean  | Evitar assunções sensíveis de RH       |
| `avoidPricingCommitments`                | Boolean  | Evitar compromissos de preço           |
| `avoidContractualCommitments`            | Boolean  | Evitar compromissos contratuais        |
| `sensitiveTopics`                        | String[] | Lista de tópicos sensíveis             |
| `requireHighConfidenceForPolicyAnswers`  | Boolean  | Exigir alta confiança para políticas   |
| `escalationInstruction`                  | String   | Instrução de escalação                 |
| `blockedBehaviors`                       | String[] | Comportamentos bloqueados              |
| `restrictedClaims`                       | String[] | Alegações restritas                    |

#### Delegation (Delegação)

| Campo             | Tipo     | Descrição                              |
|-------------------|----------|----------------------------------------|
| `ownedTopics`     | String[] | Tópicos que o brain deve tratar        |
| `deferTopics`     | String[] | Tópicos a delegar a outro assistente   |
| `allowDelegation` | Boolean  | Permitir delegação entre assistentes   |

### Instruções Avançadas (`BrainAdvancedInstructions`)

| Campo                          | Tipo   | Descrição                              |
|--------------------------------|--------|----------------------------------------|
| `additionalSystemInstructions` | String | Instruções adicionais no system prompt |
| `forbiddenPhrasing`            | String | Frases/expressões proibidas            |
| `preferredTerminology`         | String | Terminologia preferida                 |
| `outputExamples`               | String | Exemplos de output desejado            |
| `roleSpecificNotes`            | String | Notas específicas do papel             |

### Herança e Resolução

```
┌─────────────────────┐
│  Defaults (hardcoded)│ ← Fallback se não existe Brain
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  COMPANY Brain       │ ← Personalidade base da empresa
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Role Brain          │ ← Overrides por tipo (SALES, etc.)
│  (parentBrainId →   │    Deep merge: child wins
│   COMPANY brain)    │
└─────────────────────┘
```

- **`resolveEffectiveBrainConfig(companyId, brainType)`**: Resolve a configuração efetiva combinando defaults → COMPANY Brain → Role Brain.
- **Deep Merge**: Campos do child Brain sobrescrevem os do parent; campos ausentes herdam do parent.
- **Advanced Instructions**: Child non-empty fields win; empty fields inherit from parent.

### Versionamento

**Modelo `AIBrainVersion`**:

| Campo                          | Tipo     | Descrição                              |
|--------------------------------|----------|----------------------------------------|
| `brainProfileId`               | String   | FK para `AIBrainProfile`               |
| `versionNumber`                | Int      | Número sequencial da versão            |
| `status`                       | String   | `DRAFT`, `ACTIVE`, `ROLLED_BACK`       |
| `configSnapshotJson`           | Json     | Snapshot completo de `BrainConfig`     |
| `advancedInstructionsSnapshot` | Json?    | Snapshot de `BrainAdvancedInstructions`|
| `changeSummary`                | String?  | Resumo das alterações                  |
| `publishedAt`                  | DateTime?| Timestamp de publicação                |

- **Publicar**: Cria nova versão `ACTIVE`, marca a anterior como `ROLLED_BACK`.
- **Rollback**: Restaura config de uma versão anterior.

### Templates

**Modelo `AIBrainTemplate`**:

| Campo                  | Tipo    | Descrição                              |
|------------------------|---------|----------------------------------------|
| `name`                 | String  | Nome do template                       |
| `description`          | String? | Descrição                              |
| `scope`                | String  | `SYSTEM` (global), `PLAN`, `COMPANY`   |
| `brainType`            | String  | Tipo de brain alvo                     |
| `configJson`           | Json    | Configuração completa                  |
| `advancedInstructions` | Json?   | Instruções avançadas                   |
| `isLocked`             | Boolean | Se o template pode ser editado         |

- Templates permitem inicializar rapidamente um Brain com configurações pré-definidas.
- Scope `SYSTEM` = disponível para todas as empresas.

### Testes de Brain

**Modelo `AIBrainTestRun`**:

| Campo             | Tipo    | Descrição                              |
|-------------------|---------|----------------------------------------|
| `brainProfileId`  | String  | Brain testado                          |
| `brainVersionId`  | String? | Versão específica testada              |
| `assistantType`   | String  | Tipo de assistente simulado            |
| `inputPrompt`     | String  | Prompt de teste                        |
| `responseText`    | String  | Resposta gerada                        |
| `groundingStatus` | String? | Estado de fundamentação                |
| `usedSourcesJson` | Json?   | Fontes utilizadas                      |
| `metadataJson`    | Json?   | Metadados adicionais                   |

### Integração no Runtime

- **Chat IA**: `route.ts` resolve o Brain efetivo e constrói o system prompt com `buildBrainSystemPrompt()`.
- **SmartInput Rewrite**: `/api/ai/rewrite` usa o Brain do `brainType` para reescrita contextual.
- **Temperatura**: Calculada a partir de `identity.creativity` no config (`getBrainTemperature()`).

### API Routes

| Endpoint                                          | Método | Descrição                                    |
|---------------------------------------------------|--------|----------------------------------------------|
| `/api/ai/brains`                                  | GET    | Listar brains da empresa                     |
| `/api/ai/brains`                                  | POST   | Criar brain (ADMIN/SUPER_ADMIN)              |
| `/api/ai/brains/[id]`                             | GET    | Detalhe do brain com config completa         |
| `/api/ai/brains/[id]`                             | PUT    | Atualizar configuração do brain              |
| `/api/ai/brains/[id]`                             | DELETE | Eliminar brain                               |
| `/api/ai/brains/[id]/versions`                    | GET    | Listar versões do brain                      |
| `/api/ai/brains/[id]/publish`                     | POST   | Publicar nova versão                         |
| `/api/ai/brains/[id]/rollback`                    | POST   | Rollback para versão anterior                |
| `/api/ai/brains/[id]/reset-overrides`             | POST   | Resetar overrides para defaults do parent    |
| `/api/ai/brains/[id]/apply-template`              | POST   | Aplicar template a um brain                  |
| `/api/ai/brains/test`                             | POST   | Executar teste de prompt                     |
| `/api/ai/brain-templates`                         | GET    | Listar templates disponíveis                 |
| `/api/ai/rewrite`                                 | POST   | Reescrita de texto com contexto de Brain     |

### Overrides Field-Level

**Modelo `AIBrainOverride`**:

| Campo             | Tipo   | Descrição                                            |
|-------------------|--------|------------------------------------------------------|
| `brainProfileId`  | String | FK para `AIBrainProfile`                             |
| `fieldPath`       | String | Caminho do campo (ex: `identity.formality`)          |
| `overrideValueJson`| Json  | Valor do override                                    |

- Constraint `@@unique([brainProfileId, fieldPath])` — um override por campo por brain.
- Permite tracking granular de quais campos foram customizados vs herdados.

### Ficheiros

- `src/lib/ai-brains/schema.ts` — Tipos, enums, validação, deep merge
- `src/lib/ai-brains/defaults.ts` — Configurações default por brainType
- `src/lib/ai-brains/resolve-effective-brain.ts` — Resolução hierárquica
- `src/lib/ai-brains/build-brain-prompt.ts` — Construção do system prompt
- `src/lib/ai-brains/brain-runtime-adapter.ts` — Adaptador de runtime
- `src/lib/ai-brains/templates.ts` — Templates pré-definidos
- `src/lib/ai-brains/index.ts` — Re-exports
- `src/app/api/ai/brains/route.ts` — API CRUD de brains
- `src/app/api/ai/brains/[id]/route.ts` — API de detalhe/update/delete
- `src/app/api/ai/brains/[id]/publish/` — Publicação de versões
- `src/app/api/ai/brains/[id]/rollback/` — Rollback de versões
- `src/app/api/ai/brains/[id]/versions/` — Listagem de versões
- `src/app/api/ai/brains/[id]/reset-overrides/` — Reset de overrides
- `src/app/api/ai/brains/[id]/apply-template/` — Aplicação de templates
- `src/app/api/ai/brains/test/route.ts` — Teste de prompts
- `src/app/api/ai/brain-templates/route.ts` — Listagem de templates
- `src/app/api/ai/rewrite/route.ts` — API de reescrita com Brain

---

## 24. AI Product Assistant

### Descrição

Assistente de IA especializado na criação de documentação de produto estruturada e pronta para execução. Transforma ideias de produto em documentos profissionais (PRDs, BRDs, User Stories, Vibe Coding Specs, etc.) com contexto da empresa, integração RAG, e suporte a Voice Brief.

### Rota

`/product` — acessível com feature flag `product_assistant` ativa.

### Tipos de Output (14)

| Valor               | Label                | Ícone | Descrição                                        |
|---------------------|----------------------|-------|--------------------------------------------------|
| `PRD`               | PRD                  | 📋    | Product Requirements Document completo           |
| `BRD`               | Business Req         | 💼    | Business Requirements Document                   |
| `FUNCTIONAL_SPEC`   | Functional Spec      | ⚙️    | Especificação funcional                          |
| `TECHNICAL_BRIEF`   | Technical Brief      | 🔧    | Brief técnico                                    |
| `USER_STORIES`      | User Stories         | 👤    | Histórias de utilizador agrupadas por epic       |
| `ACCEPTANCE_CRITERIA`| Acceptance Criteria | ✅    | Critérios de aceitação (Given/When/Then)         |
| `FEATURE_BREAKDOWN` | Feature Breakdown    | 🧩    | Tabela de mapeamento de funcionalidades          |
| `PRODUCT_POSITIONING`| Product Positioning | 🎯    | Posicionamento de produto no mercado             |
| `BRAND_POSITIONING` | Brand Positioning    | 🏷️    | Posicionamento de marca                          |
| `VIBE_CODING_SPEC`  | Vibe Coding Spec     | 🚀    | Especificação otimizada para ferramentas AI coding |
| `ROADMAP`           | Roadmap              | 🗺️    | Recomendação de roadmap por fases                |
| `EPIC_BREAKDOWN`    | Epic + Tasks         | 📦    | Epics com breakdown de tarefas                   |
| `API_DRAFT`         | API + Entities       | 🔌    | Draft de API e modelo de dados                   |
| `DISCOVERY_ANALYSIS`| Discovery Analysis   | 🔬    | Análise de discovery com Jobs-to-be-Done         |

### Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Frontend: src/app/(dashboard)/product/page.tsx           │
│                                                          │
│  Tab 1: Create                                           │
│    - Grid de seleção de tipo de output (14 opções)       │
│    - WorkspaceSelector (project context ou empresa)      │
│    - VoiceRantBrief (auto-fill via voz)                  │
│    - Formulário: título, problema, target users,         │
│      business goal, constraints, contexto adicional      │
│    - Selectors: audience (business/technical/mixed),     │
│      detail level (brief/medium/detailed)                │
│    - Checkbox: "Use company knowledge"                   │
│    - Resultado com ReactMarkdown + md-content            │
│    - Ações: Copy, Save Draft, Regenerate, Rewrite,      │
│      Shorten, Expand                                     │
│    - Vibe Coding Block (para VIBE_CODING_SPEC)           │
│                                                          │
│  Tab 2: Documents                                        │
│    - Upload de documentos (drag & drop / click)          │
│    - Lista de documentos com eliminação                  │
│    - Documentos ficam disponíveis na knowledge base      │
│                                                          │
│  Tab 3: Drafts                                           │
│    - Lista de rascunhos guardados (open / delete)        │
│                                                          │
│  Tab 4: History                                          │
│    - Registos de gerações anteriores (open / delete)     │
└───────────────────────┬──────────────────────────────────┘
                        │ POST /api/product/generate
                        ▼
┌──────────────────────────────────────────────────────────┐
│  API: src/app/api/product/generate/route.ts               │
│                                                          │
│  1. Resolve AI Brain (PRODUCT_ASSISTANT)                 │
│  2. Carrega contexto: Project → ou → CompanyProfile      │
│  3. RAG: retrieveRelevantKnowledge() (max 10 chunks)     │
│  4. Chama GPT-4o com JSON structured output              │
│  5. Parseia: title, content, summary, vibeCodingBlock    │
│  6. Persiste em ProductGenerationRun                     │
└──────────────────────────────────────────────────────────┘
```

### Ações de Refinamento

Após gerar, o utilizador pode refinar o resultado sem perder contexto:

| Ação          | Descrição                                           |
|---------------|-----------------------------------------------------|
| 🔄 Regenerate | Gera nova versão com abordagem diferente            |
| ✏️ Rewrite    | Reescreve melhorando clareza e estrutura            |
| ✂️ Shorten    | Encurta significativamente mantendo informação chave |
| 📖 Expand     | Expande com mais detalhe, exemplos e profundidade   |

### Modelo IA

- **Modelo**: `gpt-4o`
- **Output**: JSON structured (`title`, `content`, `summary`, `vibeCodingBlock`)
- **Temperatura**: Calculada via `getBrainTemperature()` do Brain Profile
- **RAG**: `retrieveRelevantKnowledge()` com max 10 chunks
- **Brain Profile**: `PRODUCT_ASSISTANT` com herança do Brain `COMPANY`

### Modelo de Dados

**ProductGenerationRun**:

| Campo             | Tipo     | Descrição                              |
|-------------------|----------|----------------------------------------|
| `id`              | String   | UUID                                   |
| `companyId`       | String   | FK para `Company`                      |
| `userId`          | String   | FK para `User`                         |
| `outputType`      | String   | Tipo de output (PRD, BRD, etc.)        |
| `title`           | String   | Título gerado                          |
| `inputPrompt`     | String   | Prompt de entrada (`@db.Text`)         |
| `structuredInput` | Json?    | Inputs estruturados                    |
| `generationContext`| Json?   | Contexto: audience, detail, refinement |
| `outputText`      | String?  | Conteúdo gerado (`@db.Text`)           |
| `audienceType`    | String?  | `business`, `technical`, `mixed`       |
| `detailLevel`     | String?  | `brief`, `medium`, `detailed`          |
| `status`          | String   | `completed` / `error`                  |

**ProductDraft**:

| Campo       | Tipo   | Descrição                            |
|-------------|--------|--------------------------------------|
| `id`        | String | UUID                                 |
| `companyId` | String | FK para `Company`                    |
| `userId`    | String | FK para `User`                       |
| `outputType`| String | Tipo de output                       |
| `title`     | String | Título do rascunho                   |
| `content`   | String | Conteúdo completo (`@db.Text`)       |
| `metadata`  | Json?  | Metadados (summary, vibeCodingBlock) |

### API Routes

| Endpoint                        | Método | Descrição                                    |
|---------------------------------|--------|----------------------------------------------|
| `/api/product/generate`         | POST   | Gerar documentação de produto                |
| `/api/product/drafts`           | GET    | Listar drafts                                |
| `/api/product/drafts`           | POST   | Guardar draft                                |
| `/api/product/drafts/[id]`      | GET    | Obter draft                                  |
| `/api/product/drafts/[id]`      | DELETE | Eliminar draft                               |
| `/api/product/history`          | GET    | Listar histórico de gerações                 |
| `/api/product/history/[id]`     | GET    | Obter detalhe de geração                     |
| `/api/product/history`          | DELETE | Eliminar registo do histórico                |

### Ficheiros

- `src/app/(dashboard)/product/page.tsx` — Página do Product Assistant
- `src/app/(dashboard)/product/product.css` — Estilos
- `src/app/api/product/generate/route.ts` — API de geração
- `src/app/api/product/drafts/route.ts` — API de drafts
- `src/app/api/product/history/route.ts` — API de histórico

---

## 25. Client & Project Workspaces

### Descrição

Sistema de workspaces que permite criar contextos separados para clientes, projetos, ou unidades de negócio distintas. Cada workspace tem o seu próprio nome, descrição, contexto textual para IA, e documentos associados. Quando selecionado, o workspace substitui o contexto global da empresa na geração de conteúdo.

### Rota

`/projects` — acessível com feature flag `projects_workspaces` ativa.

### Funcionalidades

- **Criar projeto**: Nome (obrigatório), descrição, e contexto textual para IA (instruções, audiência, regras).
- **Editar projeto**: Modal de edição com os mesmos campos.
- **Eliminar projeto**: Com confirmação obrigatória.
- **Detalhe do projeto**: Página individual `/projects/[id]` com gestão de documentos associados.
- **VoiceRantBrief**: Suporte a briefing por voz para auto-fill dos campos do projeto.
- **Contagem de documentos**: Cada card mostra o nº de documentos associados ao projeto.

### WorkspaceSelector

Componente dropdown reutilizável (`src/components/WorkspaceSelector.tsx`) para selecionar o workspace ativo:

- **Default**: "Target Company (Default)" — usa perfil global + todos os documentos.
- **Projetos**: Lista todos os projetos do utilizador como opções.
- **Footer**: Link "Manage Workspaces ⚙️" para `/projects`.
- **Renderização condicional**: Componente é ocultado se o utilizador não tem projetos.

Quando um projeto é selecionado:
1. A geração usa o **contexto do projeto** (nome, descrição, `contextText`) em vez do perfil da empresa.
2. Os documentos listados são filtrados pelo `projectId`.

### Modelo de Dados — Project

| Campo        | Tipo     | Descrição                              |
|--------------|----------|----------------------------------------|
| `id`         | String   | UUID                                   |
| `companyId`  | String   | FK para `Company`                      |
| `createdById`| String   | FK para `User`                         |
| `name`       | String   | Nome do projeto                        |
| `description`| String?  | Descrição curta                        |
| `contextText`| String?  | Instruções/contexto para IA (`@db.Text`) |
| `createdAt`  | DateTime | Timestamp de criação                   |
| `updatedAt`  | DateTime | Timestamp de atualização               |

### API Routes

| Endpoint               | Método | Descrição                              |
|------------------------|--------|----------------------------------------|
| `/api/projects`        | GET    | Listar projetos (com contagem de docs) |
| `/api/projects`        | POST   | Criar projeto                          |
| `/api/projects/[id]`   | GET    | Obter detalhe do projeto               |
| `/api/projects/[id]`   | PUT    | Atualizar projeto                      |
| `/api/projects/[id]`   | DELETE | Eliminar projeto                       |

### Ficheiros

- `src/app/(dashboard)/projects/page.tsx` — Lista de projetos
- `src/app/(dashboard)/projects/[id]/page.tsx` — Detalhe do projeto
- `src/app/(dashboard)/projects/projects.css` — Estilos
- `src/app/api/projects/route.ts` — API CRUD
- `src/app/api/projects/[id]/route.ts` — API de detalhe
- `src/components/WorkspaceSelector.tsx` — Componente dropdown
- `src/components/WorkspaceSelector.css` — Estilos

---

## 26. VoiceRantBrief — Voice Briefing & Auto-Fill

### Descrição

Componente reutilizável que permite ao utilizador **falar livremente** sobre o que pretende, e a IA analisa a transcrição para **auto-preencher automaticamente** os campos do formulário. Suporta gravação contínua, anexação de documentos para contexto, e integração com projetos.

### Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  VoiceRantBrief Component (src/components/VoiceRantBrief)│
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  🎤 Quick Voice Brief                      │  header  │
│  │  Speak freely — AI will auto-fill the form │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  [● Start Recording]  ←── Web Speech API (continuous)    │
│  [📄 Attach documents for context]  ←── doc picker       │
│  ┌─ Transcript ─────────────────────────────┐            │
│  │  "I want to build a new feature that..."  │            │
│  └───────────────────────────────────────────┘            │
│  [✨ Auto-Fill Form]  [Clear]  [● Continue]              │
│                        │                                 │
│                        ▼                                 │
│               POST /api/ai/parse-voice-brief             │
│               { transcript, assistantType,               │
│                 fieldSchema, documentIds, projectId }     │
│                        │                                 │
│                        ▼                                 │
│               { fields: { field1: "...", ... } }         │
│               → onAutoFill(fields) callback              │
└──────────────────────────────────────────────────────────┘
```

### Props

| Prop            | Tipo                               | Descrição                                      |
|-----------------|------------------------------------|-------------------------------------------------|
| `assistantType` | `string`                           | Brain type (MARKETING, SALES, PRODUCT_ASSISTANT) |
| `fieldSchema`   | `Record<string, string>`           | Mapa de nome do campo → descrição/tipo para IA  |
| `onAutoFill`    | `(fields: Record<string, string>) => void` | Callback com campos extraídos da transcrição |
| `documents`     | `DocumentOption[]?`                | Lista de documentos disponíveis para anexar     |
| `disabled`      | `boolean?`                         | Desativar componente                            |
| `projectId`     | `string?`                          | ID do projeto para contexto                     |

### Funcionalidades

| Feature                     | Detalhes                                              |
|-----------------------------|-------------------------------------------------------|
| **Gravação contínua**       | Web Speech API (`continuous: true`), auto-restart      |
| **Timer visual**            | Cronómetro `m:ss` durante gravação                    |
| **Waveform animada**        | 8 barras animadas como feedback visual                |
| **Transcrição ao vivo**     | Interim + final results concatenados em tempo real     |
| **Document Picker**         | Checkbox list para anexar documentos como contexto    |
| **Auto-Fill IA**            | Envia transcrição para `POST /api/ai/parse-voice-brief` |
| **Continue recording**      | Pode continuar a gravar após parar (concatena)        |
| **Colapsável**              | Header clicável para colapsar/expandir                |
| **Contagem de campos**      | Mostra quantos campos foram preenchidos               |

### Páginas que Utilizam o VoiceRantBrief

| Página               | Rota         | Uso                                                 |
|----------------------|--------------|------------------------------------------------------|
| Product Assistant    | `/product`   | Auto-fill de todos os campos do formulário de produto |
| Project Workspaces   | `/projects`  | Auto-fill dos campos de criação/edição de projeto     |

### API Route

| Endpoint                    | Método | Descrição                                              |
|-----------------------------|--------|--------------------------------------------------------|
| `/api/ai/parse-voice-brief` | POST   | Analisa transcrição e extrai campos estruturados via IA |

### Ficheiros

- `src/components/VoiceRantBrief.tsx` — Componente reutilizável
- `src/components/VoiceRantBrief.css` — Estilos (card, recording state, waveform, doc picker)
- `src/app/api/ai/parse-voice-brief/route.ts` — API de parsing de voice brief

---

## 27. Standardized Markdown Rendering

### Descrição

Sistema de renderização consistente de conteúdo gerado por IA em toda a aplicação. Todos os outputs de IA (Product, Marketing, Sales, AI Brain testes) são renderizados usando o componente `ReactMarkdown` com a classe CSS global `md-content`, garantindo formatação visual uniforme.

### Componentes

- **Biblioteca**: `react-markdown` (v10+)
- **Classe CSS**: `.md-content` — aplicada ao container que envolve `<ReactMarkdown>`
- **Ficheiro CSS**: `src/styles/md-content.css` — importado globalmente via `globals.css`

### Elementos Suportados

| Elemento     | Estilo                                                  |
|-------------|----------------------------------------------------------|
| **h1–h6**   | Hierarquia de tamanhos com `border-bottom` em h1/h2     |
| **p**       | `line-height: 1.7`, margens consistentes                |
| **strong**  | `font-weight: 600`, cor primária                        |
| **em**      | Itálico, cor secundária                                 |
| **ul / ol** | Indentação `24px`, espaçamento `4px` entre itens        |
| **code**    | Inline: fundo cinza claro, monospace                    |
| **pre**     | Bloco: fundo escuro `#1e1e2e`, `overflow-x: auto`      |
| **blockquote** | Borda esquerda vermelha, fundo subtle                |
| **table**   | Bordas, header uppercase, hover em linhas               |
| **a**       | Cor accent, sem sublinhado (sublinhado no hover)        |
| **img**     | `max-width: 100%`, `border-radius: 8px`                |
| **hr**      | Linha subtil `1px solid`                                |

### Páginas com Markdown Rendering

| Página               | Containers com `.md-content`                              |
|----------------------|-----------------------------------------------------------|
| **Product**          | `.prd-result-content`, `.prd-vibe-content`                |
| **Sales**            | `.sal-result-content`, `.sal-section-content`             |
| **Marketing**        | `.mkt-result-content`, `.mkt-section-content`             |
| **AI Brain**         | `.response-text` (testes de prompt)                       |
| **Chat**             | Usa `renderMarkdown()` próprio (mantido separado)         |

### Ficheiros

- `src/styles/md-content.css` — Estilos globais de markdown
- `src/app/globals.css` — `@import` do `md-content.css`

### RAG (Retrieval-Augmented Generation)

Como parte da estandardização, todos os assistentes de geração (Product, Marketing, Sales) passaram a integrar automaticamente **RAG** via a utilidade partilhada `src/lib/rag-retrieval.ts`:

**Pipeline de Retrieval (5 estágios)**:

1. **Embedding da query** via `text-embedding-3-small`
2. **Cosine similarity** contra `DocumentEmbedding` (filtro `companyId`)
3. **Metadata enrichment** — filename, categoria, prioridade, use-as-knowledge-source
4. **Composite ranking** — boosts: curated (+0.15), priority (+0.05/+0.10), recency (+0.03); penalty: noise (-0.10)
5. **Dedup + diversity** — max 3 chunks/doc, max 8 chunks total, skip <30 chars

**Exports**:
- `retrieveRelevantKnowledge(companyId, query, options)` — retorna `RetrievedChunk[]`
- `formatRAGContext(chunks)` — formata chunks para injeção no system prompt

**Ficheiro**: `src/lib/rag-retrieval.ts`

---

## 28. AI Tasks / Execution Workspace

### Descrição

Gestor de tarefas estilo **Kanban** integrado como **camada de execução operacional** da plataforma. Não é um PM tool genérico — está ligado diretamente aos assistentes IA, base de conhecimento, projetos e workflows da empresa.

Um output de chat pode tornar-se tarefa, uma lacuna de conhecimento pode gerar um plano de remediação, um product brief pode gerar epics/tarefas, e um output de marketing/sales pode tornar-se checklist de execução.

### Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend: src/app/(dashboard)/tasks/page.tsx                │
│  - Top bar: Board selector, create/delete board              │
│  - Kanban board com @dnd-kit drag-and-drop                   │
│  - Task cards (priority stripe, assignee, due date, source)  │
│  - Inline task creation por coluna                           │
│  - Task detail drawer (description, comments, activity)      │
│  - Add/delete columns                                        │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  API Routes (10 ficheiros)                                   │
│  GET/POST  /api/tasks/boards               (listar/criar)    │
│  GET/PUT/DEL /api/tasks/boards/[id]        (detalhe/editar)  │
│  POST      /api/tasks/boards/[id]/columns  (criar coluna)    │
│  PUT/DEL   /api/tasks/columns/[id]         (editar/elim col) │
│  GET/POST  /api/tasks                      (listar/criar)    │
│  GET/PUT/DEL /api/tasks/[id]               (detalhe/upd/del) │
│  POST      /api/tasks/[id]/move            (mover tarefa)    │
│  GET/POST  /api/tasks/[id]/comments        (comentários)     │
│  POST/DEL  /api/tasks/[id]/links           (ligações)        │
│  GET       /api/user/team                  (lista utilizadores)│
└──────────────────────────────────────────────────────────────┘
```

### Modelo de Dados

**TaskBoard**:

| Campo         | Tipo     | Descrição                                       |
|---------------|----------|--------------------------------------------------|
| `id`          | String   | UUID, chave primária                             |
| `companyId`   | String   | FK para `Company`                                |
| `projectId`   | String?  | FK para `Project` (opcional, ligação a workspace) |
| `name`        | String   | Nome do quadro                                   |
| `description` | String?  | Descrição do quadro                              |
| `createdById` | String   | FK para `User` criador                           |
| `createdAt`   | DateTime | Timestamp de criação                             |
| `updatedAt`   | DateTime | Timestamp de última atualização                  |

**TaskBoardColumn**:

| Campo      | Tipo     | Descrição                                         |
|------------|----------|----------------------------------------------------|
| `id`       | String   | UUID                                               |
| `boardId`  | String   | FK para `TaskBoard` (cascade delete)               |
| `name`     | String   | Nome da coluna (ex: To Do, In Progress, Done)      |
| `position` | Int      | Ordem na board                                     |
| `color`    | String?  | Cor hex da coluna                                  |
| `isDone`   | Boolean  | Marca a coluna como "concluído"                    |
| `isDefault`| Boolean  | Impede eliminação de colunas padrão                |

**Task**:

| Campo        | Tipo     | Descrição                                          |
|--------------|----------|-----------------------------------------------------|
| `id`         | String   | UUID                                                |
| `boardId`    | String   | FK para `TaskBoard` (cascade delete)                |
| `columnId`   | String   | FK para `TaskBoardColumn` (cascade delete)          |
| `title`      | String   | Título da tarefa                                    |
| `description`| String?  | Descrição detalhada (`@db.Text`)                    |
| `priority`   | String   | `low` / `medium` / `high` / `urgent` (default: `medium`) |
| `position`   | Int      | Ordem na coluna                                     |
| `dueDate`    | DateTime?| Data limite                                         |
| `labels`     | String?  | JSON array de etiquetas                             |
| `assigneeId` | String?  | FK para `User` responsável                          |
| `sourceType` | String?  | Origem: `MANUAL`, `CHAT`, `KNOWLEDGE_GAP`, `PRODUCT_BRIEF`, etc. |
| `sourceId`   | String?  | ID da entidade de origem                            |
| `createdById`| String   | FK para `User` criador                              |
| `createdAt`  | DateTime | Timestamp de criação                                |
| `updatedAt`  | DateTime | Timestamp de última atualização                     |

**TaskComment**:

| Campo     | Tipo     | Descrição                         |
|-----------|----------|------------------------------------|
| `id`      | String   | UUID                               |
| `taskId`  | String   | FK para `Task` (cascade delete)    |
| `userId`  | String   | FK para `User`                     |
| `content` | String   | Conteúdo do comentário (`@db.Text`)|
| `createdAt`| DateTime | Timestamp de criação              |

**TaskActivity**:

| Campo     | Tipo     | Descrição                                           |
|-----------|----------|------------------------------------------------------|
| `id`      | String   | UUID                                                 |
| `taskId`  | String   | FK para `Task` (cascade delete)                      |
| `actorId` | String   | FK para `User` que executou a ação                   |
| `action`  | String   | `created`, `moved`, `assigned`, `commented`, `updated`, `priority_changed`, `linked` |
| `metadata`| Json?    | Dados adicionais (ex: `{from, to}` para movimentação)|
| `createdAt`| DateTime | Timestamp                                           |

**TaskLink**:

| Campo        | Tipo     | Descrição                                        |
|--------------|----------|---------------------------------------------------|
| `id`         | String   | UUID                                              |
| `taskId`     | String   | FK para `Task` (cascade delete)                   |
| `linkType`   | String   | `DOCUMENT`, `CONVERSATION`, `KNOWLEDGE_GAP`, `PROJECT`, `URL` |
| `linkId`     | String?  | ID da entidade ligada                             |
| `linkUrl`    | String?  | URL externo                                       |
| `linkTitle`  | String?  | Título descritivo                                 |
| `createdById`| String   | FK para `User`                                    |
| `createdAt`  | DateTime | Timestamp                                         |

### Colunas Padrão

Ao criar um novo board, são criadas automaticamente 3 colunas:

| Nome          | Posição | isDone | isDefault | Cor     |
|---------------|---------|--------|-----------|---------|
| To Do         | 0       | false  | true      | #6337ff |
| In Progress   | 1       | false  | true      | #f59e0b |
| Done          | 2       | true   | true      | #10b981 |

### Drag-and-Drop

- **Biblioteca**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Sensor**: `PointerSensor` com `activationConstraint: { distance: 5 }`
- **Colisão**: `closestCorners`
- **Comportamento**: Optimistic update seguido de sync com servidor via `POST /api/tasks/[id]/move`
- **Overlay**: Card fantasma rotacionado durante arrasto

### Task Detail Drawer

Painel deslizante à direita (520px) com:

| Secção        | Funcionalidade                                                |
|---------------|---------------------------------------------------------------|
| **Header**    | Título editável inline (blur = save)                          |
| **Campos**    | Priority, Assignee, Due Date, Column — dropdowns/inputs       |
| **Descrição** | Textarea editável (blur = save)                               |
| **Comentários**| Lista cronológica + form para adicionar novo comentário      |
| **Atividade** | Timeline de ações (created, moved, assigned, commented, etc.) |
| **Footer**    | Botão eliminar + badge de origem (MANUAL, CHAT, etc.)         |

### Registo de Atividade

Ações registadas automaticamente como `TaskActivity`:

| Ação               | Quando                              | Metadata                  |
|--------------------|--------------------------------------|---------------------------|
| `created`          | Tarefa criada                       | —                         |
| `moved`            | Tarefa movida entre colunas         | `{from: "To Do", to: "In Progress"}` |
| `assigned`         | Responsável alterado                | —                         |
| `commented`        | Comentário adicionado               | —                         |
| `priority_changed` | Prioridade alterada                 | `{from: "low", to: "high"}` |
| `updated`          | Outros campos alterados             | —                         |
| `linked`           | Link adicionado                     | `{linkType, linkTitle}`   |

### Feature Flag

- **Chave**: `tasks`
- **Guard**: `/tasks` protegido em `FEATURE_GUARDS` no layout
- **Backoffice**: Adicionado a `ALL_FEATURES` e `AVAILABLE_FEATURES` — ativável via painel de features da empresa
- **Default**: Ativado para novas empresas criadas via backoffice

### API Routes

| Endpoint                              | Método      | Descrição                                        |
|---------------------------------------|-------------|--------------------------------------------------|
| `GET /api/tasks/boards`               | GET         | Listar boards da empresa                         |
| `POST /api/tasks/boards`              | POST        | Criar board (com 3 colunas padrão)               |
| `GET /api/tasks/boards/[id]`          | GET         | Detalhe do board (colunas + tarefas)             |
| `PUT /api/tasks/boards/[id]`          | PUT         | Atualizar board (nome, descrição)                |
| `DELETE /api/tasks/boards/[id]`       | DELETE      | Eliminar board (cascade)                         |
| `POST /api/tasks/boards/[id]/columns` | POST        | Criar coluna (posição auto-incrementada)         |
| `PUT /api/tasks/columns/[id]`         | PUT         | Atualizar coluna (nome, cor, isDone)             |
| `DELETE /api/tasks/columns/[id]`      | DELETE      | Eliminar coluna (verifica tarefas + isDefault)   |
| `GET /api/tasks`                      | GET         | Listar tarefas (filtros: boardId, columnId, priority, assigneeId) |
| `POST /api/tasks`                     | POST        | Criar tarefa (posição auto, activity log)        |
| `GET /api/tasks/[id]`                 | GET         | Detalhe da tarefa (comments, activity, links)    |
| `PUT /api/tasks/[id]`                 | PUT         | Atualizar tarefa (com change tracking)           |
| `DELETE /api/tasks/[id]`              | DELETE      | Eliminar tarefa                                  |
| `POST /api/tasks/[id]/move`           | POST        | Mover tarefa entre colunas (activity log)        |
| `GET /api/tasks/[id]/comments`        | GET         | Listar comentários (enriched com user info)      |
| `POST /api/tasks/[id]/comments`       | POST        | Adicionar comentário (activity log)              |
| `POST /api/tasks/[id]/links`          | POST        | Adicionar link à tarefa (activity log)           |
| `DELETE /api/tasks/[id]/links`        | DELETE      | Remover link da tarefa                           |
| `GET /api/user/team`                  | GET         | Listar utilizadores da empresa (para assignee)   |

### Internacionalização

Secção `tasks` adicionada a `en.json`, `pt-PT.json` e `fr.json` com ~60 chaves, cobrindo:
- Títulos e subtítulos da página
- Boards: criar, editar, eliminar, seletor
- Colunas: adicionar, editar, eliminar
- Tarefas: título, descrição, prioridades (low/medium/high/urgent), assignee, due date, labels
- Interação: comentários, atividade, links, filtros
- Mensagens de atividade dinâmicas com placeholders `{from}`, `{to}`

### Ficheiros

- `src/app/(dashboard)/tasks/page.tsx` — Página principal com Kanban board, drawer, modals
- `src/app/(dashboard)/tasks/tasks.css` — Estilos (kanban, cards, drawer, modal, animações)
- `src/app/api/tasks/boards/route.ts` — Board CRUD (list + create)
- `src/app/api/tasks/boards/[id]/route.ts` — Board detail, update, delete
- `src/app/api/tasks/boards/[id]/columns/route.ts` — Column create
- `src/app/api/tasks/columns/[id]/route.ts` — Column update, delete
- `src/app/api/tasks/route.ts` — Task list + create
- `src/app/api/tasks/[id]/route.ts` — Task detail, update, delete
- `src/app/api/tasks/[id]/move/route.ts` — Task move
- `src/app/api/tasks/[id]/comments/route.ts` — Task comments
- `src/app/api/tasks/[id]/links/route.ts` — Task links
- `src/app/api/user/team/route.ts` — Company user list
- `prisma/schema.prisma` — 6 novos modelos
