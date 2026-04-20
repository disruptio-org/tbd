# Nousio — Technical Documentation

> **Comprehensive technical documentation** for the Nousio AI-powered enterprise platform.

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd Disruptio
npm install

# Configure environment
cp .env.example .env.local
# Fill in: DATABASE_URL, Supabase keys, OPENAI_API_KEY

# Run database migrations
npx prisma db push

# Start development server
npm run dev        # http://localhost:5000
```

## What is Nousio?

Nousio is an **AI-native SaaS platform** that enables companies to build, manage, and operationalize AI intelligence layers on top of their own business knowledge. It provides growth assistants for Marketing, Sales, Product, and Company Advisory, alongside document management, RAG-powered knowledge retrieval, CRM, task boards, and access control — all within a multi-tenant architecture.

## Documentation Index

### Product
| Document | Description |
|----------|-------------|
| [Product Overview](product/01-product-overview.md) | What Nousio does, who uses it, main workflows |
| [Domain Model](product/02-domain-model.md) | Core business entities and relationships |
| [Business Rules](product/03-business-rules.md) | Subscription, usage, ownership, deletion rules |
| [Feature Flows](product/04-feature-flows.md) | End-to-end flow for each major feature |

### Architecture
| Document | Description |
|----------|-------------|
| [System Architecture](architecture/01-system-architecture.md) | High-level architecture, request flow, dependencies |
| [Tech Stack](architecture/02-tech-stack.md) | Technologies, versions, and rationale |
| [Backend Architecture](architecture/03-backend-architecture.md) | API routes, services, data access patterns |
| [Frontend Architecture](architecture/04-frontend-architecture.md) | App structure, routing, components, design system |
| [AI Architecture](architecture/05-ai-architecture.md) | LLM usage, prompt orchestration, model routing |
| [RAG & Knowledge Pipeline](architecture/06-rag-and-knowledge-pipeline.md) | Ingestion, embedding, retrieval, ranking |
| [Integrations](architecture/07-integrations.md) | External services, OAuth, webhooks |

### Engineering
| Document | Description |
|----------|-------------|
| [API Spec](engineering/01-api-spec.md) | Endpoint catalog, auth, pagination |
| [Auth & Authorization](engineering/02-authentication-and-authorization.md) | Login flows, RBAC, access groups |
| [Environment Config](engineering/03-environment-configuration.md) | Env vars, secrets, feature flags |
| [Deployment & Infra](engineering/04-deployment-and-infrastructure.md) | CI/CD, hosting, scaling |
| [Security](engineering/05-security.md) | Tenant isolation, encryption, prompt injection |
| [Observability](engineering/06-observability-and-monitoring.md) | Logs, metrics, error tracking |
| [Testing Strategy](engineering/07-testing-strategy.md) | Unit, integration, E2E, AI evaluation |
| [Coding Standards](engineering/08-coding-standards.md) | Naming, patterns, conventions |

### Planning
| Document | Description |
|----------|-------------|
| [Technical Roadmap](planning/01-roadmap-technical.md) | Upcoming modules, infra evolution |
| [Known Issues & Tech Debt](planning/02-known-issues-and-technical-debt.md) | Bottlenecks, legacy areas, refactor priorities |
| [Decision Log](planning/03-decision-log.md) | Architecture Decision Records |

### Supporting
| Document | Description |
|----------|-------------|
| [Glossary](glossary.md) | Key terms and definitions |

## Main Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx prisma studio    # Visual database browser
npx prisma db push   # Apply schema changes
```

## Key Entry Points

- **Dashboard**: `src/app/(dashboard)/` — Main authenticated app shell
- **API Routes**: `src/app/api/` — 30+ API modules
- **Shared Libraries**: `src/lib/` — Auth, RAG, embeddings, permissions
- **Backoffice**: `src/app/backoffice/` — Super admin panel
- **Design System**: `src/app/globals.css` + per-module CSS (`company-dna.css`, `documents.css`, `ai-brain.css`) — Tactile Brutalism design tokens
