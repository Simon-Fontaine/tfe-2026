# Dashboard IA Spec

## Canonical dashboard domains

### 1) Home
- **Route:** `/dashboard`
- **Purpose:** Personal summary, recent activity context, and action shortcuts into each domain.

### 2) Workspace
- **Route group:** `/dashboard/workspace/...`
- **Purpose:** Team operations and organizational management.
- **Includes:**
  - `/dashboard/workspace/orgs`
  - `/dashboard/workspace/orgs/[orgId]`
  - `/dashboard/workspace/orgs/[orgId]/teams/[teamId]`

### 3) Recruit
- **Route group:** `/dashboard/recruit/...`
- **Purpose:** LFG, applications, and invitation workflows.
- **Includes:**
  - `/dashboard/recruit/lfg`
  - `/dashboard/recruit/applications`
  - `/dashboard/recruit/invitations`

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
- Canonical dashboard URLs are defined in `apps/web/docs/route-map.md`.
- Legacy paths are not maintained; only canonical URLs are supported.
