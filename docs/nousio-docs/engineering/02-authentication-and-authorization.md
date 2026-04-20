# 02 — Authentication & Authorization

## Login Methods

| Method | Provider | Implementation |
|--------|----------|---------------|
| **Email/Password** | Supabase Auth | Standard email + password via `supabase.auth.signInWithPassword()` |
| **Google OAuth** | Supabase + Google | OAuth 2.0 flow via `supabase.auth.signInWithOAuth({ provider: 'google' })` |

## Session / Token Strategy

- **JWT-based** via Supabase Auth
- **Cookie storage**: Session tokens stored in HTTP-only cookies via `@supabase/ssr`
- **Server-side validation**: `createClient()` reads cookies → `supabase.auth.getUser()` validates JWT
- **No manual token management**: Supabase SSR handles refresh automatically

## Authentication Flow

```
User Login (email/password or Google OAuth)
  │
  ▼
Supabase Auth issues JWT (stored in cookie)
  │
  ▼
API Request → createClient() → supabase.auth.getUser()
  │
  ├── Invalid/Expired → 401 Unauthorized
  │
  └── Valid → ensureDbUser(supabaseUser)
       │
       ├── User exists in DB → return dbUser
       │
       └── No DB record → create User record
            (auto-assign to company if exists)
```

## Password / Reset / Invite Flows

### Admin-Provisioned Users
1. Admin creates user via Settings → Users or Backoffice
2. User created with `mustChangePassword: true`, `isProvisionedByAdmin: true`
3. User receives credentials (email + temp password)
4. On first login → redirected to `/first-login`
5. User sets new password → `mustChangePassword` set to false
6. Redirected to Setup wizard or Dashboard

### Self-Registration
1. User signs up at `/signup` with email + password
2. Supabase Auth creates auth identity
3. `ensureDbUser()` creates DB User on first API call
4. Redirected to Setup wizard

### Password Reset
- Handled by Supabase Auth's built-in password reset flow
- Reset email sent by Supabase; user resets via Supabase-hosted UI

## RBAC — Role-Based Access Control

### System Roles

| Role | Scope | Capabilities |
|------|-------|-------------|
| `SUPER_ADMIN` | Platform | Access Backoffice, manage all companies, create/delete companies and users |
| `ADMIN` | Company | Manage users, manage access groups, full feature access within company |
| `MEMBER` | Company | Access determined by Access Group memberships |

### Access Group Permission Model

```
AccessGroup ──has──▶ AccessPermissionGrant
                       │
                       ├── resourceType: FEATURE
                       │   resourceKey: "marketing"
                       │   accessLevel: USE
                       │
                       ├── resourceType: SUB_FEATURE
                       │   resourceKey: "documents.upload"
                       │   accessLevel: MANAGE
                       │
                       └── resourceType: PROJECT_SCOPE
                           resourceKey: "projects:all"
                           accessLevel: USE
```

### Resolution Algorithm (`resolveEffectiveAccess()`)

1. Load user role and status
2. If `ADMIN` or `SUPER_ADMIN`: return full access (all features + all projects)
3. If `MEMBER`: start with baseline minimal access
4. Load all `AccessGroupMembership` for this user
5. Load all `AccessPermissionGrant` from those groups
6. **Union** all permissions (most permissive wins):
   - Feature: highest access level across all groups
   - Sub-feature: merged from all groups
   - Project scope: union of all allowed projects or `projects:all`
7. Return `EffectiveAccess` object

### Access Level Hierarchy
```
VIEW < USE < MANAGE
```
Higher levels include all lower-level permissions.

## Workspace / Company Isolation

- **Multi-tenant by design**: All data is scoped by `companyId`
- Every API query includes `companyId` filter derived from the authenticated user
- Users can only belong to one company (enforced by `companyId` FK)
- Super Admin can access data across companies through Backoffice APIs
- Supabase RLS is available but not actively used (data isolation enforced at application layer)

## Service-to-Service Auth

- **Admin Supabase Client**: Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- Used for: user management operations, auth admin, storage admin
- Located in `src/lib/supabase/admin.ts`

## Security Rules Around Protected Resources

| Resource | Protection |
|----------|-----------|
| Documents | Company-scoped; only company members can access |
| Conversations | Company-scoped; no user-level conversation ACL |
| CRM Leads | Company-scoped; all company members can view |
| Tasks | Company-scoped; all company members can view/edit |
| Access Groups | Only `ADMIN` can create/modify |
| User Management | Only `ADMIN` can invite/deactivate users |
| Backoffice | Only `SUPER_ADMIN` |
| Feature toggles | Only `SUPER_ADMIN` via Backoffice |
