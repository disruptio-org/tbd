# 04 — Frontend Architecture

## App Structure

```
src/app/
├── layout.tsx              # Root layout (font, metadata)
├── globals.css             # Design system tokens + global styles
├── providers.tsx           # React context providers
├── login/                  # Public login page
├── signup/                 # Public signup page
├── first-login/            # Password change on first login
├── setup/                  # Onboarding wizard (6 steps)
│   ├── layout.tsx          # Setup-specific layout (dark bg, centered)
│   ├── page.tsx            # Wizard logic and steps
│   └── setup.css           # Setup-specific styles
├── backoffice/             # Super admin panel
│   ├── layout.tsx          # Backoffice layout with sidebar
│   ├── page.tsx            # Company list
│   ├── companies/[id]/     # Company detail
│   ├── analytics/          # Platform analytics
│   └── backoffice.css      # Backoffice styles
└── (dashboard)/            # Main authenticated app (route group)
    ├── layout.tsx          # Dashboard shell (sidebar, header, nav)
    ├── page.tsx            # Dashboard home redirect
    ├── dashboard/          # Dashboard overview
    ├── chat/               # AI Chat conversations
    ├── documents/          # Document management
    ├── marketing/          # Marketing assistant
    ├── sales/              # Sales assistant
    ├── product/            # Product assistant
    ├── leads/              # Lead discovery
    ├── crm/                # CRM pipeline
    ├── tasks/              # Task boards
    ├── projects/           # Project management
    ├── classifications/    # Data extraction
    ├── knowledge-gaps/     # Knowledge gap detection
    ├── company/            # Company profile view
    ├── company-advisor/    # Company advisor assistant
    ├── onboarding-assistant/ # Onboarding content
    ├── search/             # Semantic search
    ├── settings/           # User and company settings
    ├── dashboard.css       # Main dashboard styles
    └── dashboard-home.css  # Dashboard home stats
```

## Routing

- **Next.js App Router** with file-system based routing
- **Route Groups**: `(dashboard)` groups all authenticated pages under one layout with shared sidebar
- **Dynamic Routes**: `[id]` pattern for entity detail pages (e.g., `/companies/[id]`, `/tasks/boards/[id]`)
- **No client-side router**: uses `next/navigation` (`useRouter().push()`, `useRouter().replace()`)

## State Management

- **No external state library** (no Redux, no Zustand, no Jotai)
- Local state via `useState` + `useEffect`
- Server state fetched via `fetch()` in `useEffect` on mount
- No React Query or SWR for caching/deduplication
- Auth state managed by Supabase client library

## Component Architecture

- **Page components**: Each route has a `page.tsx` that contains the full page logic
- **No shared component library**: Components are inline within page files
- **Shared hooks**: `useWhisper.ts` for voice, `useUIFeedback` for toast notifications
- **UI patterns**: Cards, forms, tables, modals built directly with CSS classes

## Design System: Tactile Brutalism

Defined in `globals.css` with CSS custom properties, extended by per-module CSS (`company-dna.css`, `documents.css`, `ai-brain.css`):

### Key Tokens
```css
--color-bg-base: #f6f5f0         /* warm off-white */
--color-bg-surface: #ffffff       /* card backgrounds */
--color-text-primary: #1a1a2e    /* near-black */
--color-accent-primary: #2563eb  /* Nousio Blue */
--color-stroke-subtle: #d4d0c8   /* borders */
```

### Design Rules
- **0px border-radius** everywhere (square corners)
- **2px borders** for standard elements, **4px** for primary modules
- **4px shadow offset** (`shadow-[4px_4px_0px_#000]`) for interactive elements
- **Uppercase bold text** for headers and labels (font-weight: 900, letter-spacing)
- **Active state**: translate + remove shadow to simulate "physical press"
- **Lucide React** for all icons (no emojis)

## Form Handling

- Native HTML form elements (`<input>`, `<textarea>`, `<select>`)
- Controlled components via `useState`
- Manual validation (no form library like React Hook Form)
- Error display via inline state variables

## Permissions & Dynamic Sidebar

1. On login, frontend fetches `/api/user/effective-access` and `/api/ai/brains`
2. `EffectiveAccess` object determines:
   - Which sidebar items are visible
   - Which features are accessible
   - Which sub-features (e.g., upload, delete) are enabled
3. **RESOURCES section is dynamic**: Sidebar resource links are built from actual `AIBrainProfile` records. Only team members that exist appear. Deleting a brain removes it from the sidebar.
4. Admin role bypasses all restrictions
5. Stored in dashboard layout state, passed down via props

## Loading/Error States

- **Loading**: `<div className="spinner" />` CSS spinner or conditional render
- **Empty states**: Illustrated messages with icons and description text
- **Error states**: Toast notifications via `useUIFeedback` or inline error messages
- **No global error boundary** implemented

## AI Features in Interface

- **Chat**: Conversational UI with markdown rendering, voice input toggle
- **Growth Assistants**: Form-based input → AI generation → rendered output with save/copy
- **AI Brain Settings**: Configuration panels for personality, reasoning, output style
- **Knowledge Gaps**: Dashboard showing auto-detected blind spots in company knowledge

## Document Management UI

- **Bulk Selection**: Select-all checkbox and per-row checkboxes with a dark-themed bulk action bar
- **Bulk Actions**: Reprocess, Category, Priority, Mark Curated, Delete — all styled in Tactile Brutalism
- **OCR Status Badge**: Color-coded status badges for `PROCESSED`, `PENDING`, `PROCESSING`, `ERROR`
- **Version Display**: Document version number shown in table rows
- **External Doc Integration**: Google Drive and Notion docs shown in separate filter tabs with `ext-` prefixed IDs
