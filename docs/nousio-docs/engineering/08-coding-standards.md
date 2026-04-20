# 08 — Coding Standards

## Language & Framework

- **TypeScript** everywhere (strict mode)
- **Next.js App Router** conventions
- **ESLint** for linting

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (pages) | `page.tsx` (Next.js required) | `src/app/(dashboard)/chat/page.tsx` |
| Files (API routes) | `route.ts` (Next.js required) | `src/app/api/chat/conversations/route.ts` |
| Files (CSS) | kebab-case | `dashboard-home.css`, `setup.css` |
| Files (lib modules) | kebab-case | `rag-retrieval.ts`, `access-resolver.ts` |
| React components | PascalCase (function name) | `export default function ChatPage()` |
| Variables | camelCase | `companyId`, `uploadedFiles` |
| Constants | UPPER_SNAKE_CASE | `FEATURE_KEYS`, `CHUNK_SIZE` |
| Interfaces/Types | PascalCase | `CompanyProfile`, `RetrievedChunk` |
| Enums (Prisma) | PascalCase | `UserRole`, `MessageRole` |
| Database tables | PascalCase (Prisma convention) | `Company`, `DocumentEmbedding` |
| Database fields | camelCase | `companyId`, `createdAt` |
| CSS classes | kebab-case with component prefix | `.setup-card`, `.dashboard-stat` |
| API endpoints | kebab-case | `/api/knowledge-gaps`, `/api/company-advisor` |

## Folder Conventions

```
src/app/
├── api/<module>/route.ts       # API endpoints
├── (dashboard)/<module>/       # Authenticated pages
│   ├── page.tsx               # Main page component
│   └── <module>.css           # Module-specific styles
├── <public-route>/             # Unauthenticated pages
└── globals.css                 # Design system tokens
```

## API Route Patterns

Every API route follows this structure:

```typescript
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const auth = await getCurrentUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { dbUser } = auth;
        // Business logic here...

        return NextResponse.json({ data });
    } catch (err) {
        console.error('[module] Error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
```

## Validation Rules

- Use **Zod** for complex input validation
- Simple cases: manual `if (!field)` checks
- Always return descriptive error messages
- Always return appropriate HTTP status codes

## Error Conventions

```typescript
// Standard error responses
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
return NextResponse.json({ error: 'Forbidden — ADMIN required' }, { status: 403 });
return NextResponse.json({ error: 'Company not found' }, { status: 404 });
return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
```

## Logging Conventions

```typescript
// Tagged logging with domain prefix
console.log('[auth] No Supabase user in session');
console.log('[rag] Retrieved 5 chunks for company abc');
console.log('[embed] Generating embeddings for 12 chunks');
console.error('[backoffice/users POST] Error:', error);
```

## CSS / Design System Conventions

### Design Tokens (in `globals.css`)
```css
--color-bg-base: #f6f5f0;
--color-bg-surface: #ffffff;
--color-text-primary: #1a1a2e;
--color-accent-primary: #2563eb;
--color-stroke-subtle: #d4d0c8;
```

### Tactile Brutalism Rules
- **0px border-radius** everywhere
- **2px borders** for standard elements, **4px** for primary
- **4px shadow offset** for interactive elements
- **Uppercase + 900 weight** for labels and headers
- **Lucide React** icons (never emojis)

## Import Patterns

```typescript
// Always use path aliases
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Group imports: React → Next → External → Internal
import { useState, useEffect } from 'react';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCurrentUser } from '@/lib/auth';
```

## File Organization

- **One page component per file** (page.tsx)
- **Utility functions** in `src/lib/`
- **CSS** co-located with pages (e.g., `dashboard.css` in `(dashboard)/`)
- **No shared component directory** (components are inline)
- **No barrel exports** (import directly from source files)
