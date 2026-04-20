# 00 — Global Layout & Navigation

## Route
`/(dashboard)/layout.tsx` — wraps all dashboard pages

## Purpose
The **global dashboard shell** providing sidebar navigation, user authentication gating, feature-flag filtering, and the Action Assistant floating button. Every page inside the `(dashboard)` group is wrapped by this layout.

## UX Flow
1. **Page load** → checks onboarding status (`/api/user/onboarding-status`)
   - If `mustChangePassword` → redirect to `/first-login`
   - If onboarding incomplete → redirect to `/setup`
   - Otherwise → render dashboard
2. **Parallel API calls** on mount:
   - `/api/user/features` — loads enabled feature flags + effective access
   - `/api/user/profile` — loads user name, email, avatar, role
   - `/api/ai/brains` — loads AI team members for dynamic sidebar "Resources" section
3. **Feature guard** — checks current route against `FEATURE_GUARDS` map. If user lacks access, redirects to `/dashboard`
4. **Sidebar state** — collapsed/expanded state persisted to `localStorage`

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/user/onboarding-status` | GET | Page load | Check if user needs onboarding | ~200ms |
| `/api/user/features` | GET | Page load | Load feature flags & access groups | ~300ms |
| `/api/user/profile` | GET | Page load | User info for sidebar footer | ~200ms |
| `/api/ai/brains` | GET | Page load | Dynamic "Resources" nav items | ~300ms |

## Components & Sections
- **Sidebar** — Collapsible left panel with grouped navigation
  - Logo + collapse toggle
  - 4 nav groups: (flat) Dashboard, Setup, Execution, Resources
  - Each group expandable/collapsible with chevron
  - Items filtered by feature flags + user role
  - Dynamic "Resources" section populated from AI brain members
  - User profile card at bottom (links to /settings)
  - Logout button
- **Mobile overlay** — Full-screen backdrop when sidebar open on mobile
- **Mobile header** — Top bar with hamburger menu toggle
- **Action Assistant Launcher** — Global FAB (floating action button) on every page
- **Language Provider** — Wraps all children in i18n context

## Key Behaviors
- Sidebar defaults to **collapsed** on first load
- Auto-expands the group containing the active route
- Admin-only items hidden for MEMBER users
- Feature-gated items hidden when company hasn't enabled the feature
