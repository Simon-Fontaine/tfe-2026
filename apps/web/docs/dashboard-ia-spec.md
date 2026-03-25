# Dashboard IA Spec

## Domain model

### 1) Home
- **Route:** `/dashboard`
- **Purpose:** Personal summary, recent activity context, and action shortcuts into each domain.

### 2) Workspace
- **Route group:** `/dashboard/workspace/...`
- **Purpose:** Team operations and organizational management.
- **Includes:**
  - `/dashboard/workspace` (workspace overview / org list entry point)
  - `/dashboard/workspace/orgs/[orgId]`
  - `/dashboard/workspace/teams/[teamId]`

### 3) Recruit
- **Route group:** `/dashboard/recruit/...`
- **Purpose:** Discovery, LFG, and recruiting workflows.
- **Includes:**
  - `/dashboard/recruit/lfg`
  - `/dashboard/recruit/teams`
  - `/dashboard/recruit/applications`
  - `/dashboard/recruit/inbox`

### 4) Personal
- **Route group:** `/dashboard/me/...`
- **Purpose:** User-owned profile and account preferences.
- **Includes:**
  - `/dashboard/me/profile`
  - `/dashboard/me/schedule`
  - `/dashboard/me/notifications`
  - `/dashboard/me/settings`
  - `/dashboard/me/settings/security`

## URL policy
- Canonical dashboard URLs are only the routes above.
- Legacy URLs under prior dashboard paths are intentionally not maintained.
