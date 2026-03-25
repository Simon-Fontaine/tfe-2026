# Public Route Readiness Checklist

Use this checklist before exposing any route in `siteConfig.nav.primary`.

## Strategy choice (required)

Pick exactly one strategy:

- **Build now**: Ship a minimal but useful read-only experience.
- **In development**: Gate the route with explicit status + internal testing CTA messaging.

## Checklist

- [ ] Route has explicit product intent in the first viewport (what this page is for, today).
- [ ] Copy does **not** imply unavailable functionality.
- [ ] If incomplete, route includes clear “In development” status language.
- [ ] Route includes at least one concrete next action (e.g., sign in, register, contact, or alternate live route).
- [ ] Route links to an actually available flow (no dead-end CTA).
- [ ] If route appears in primary nav, it provides useful read-only value immediately.
- [ ] Ownership is assigned for post-launch feedback and iteration.

## Current decisions for `(home)` public routes

- `/teams` → **Build now** (read-only team previews + recruiting/dashboard CTAs).
- `/players` → **In development**.
- `/players/[username]` → **In development**.
- `/orgs` → **In development**.
- `/orgs/[orgId]` → **In development**.
- `/scrims` → **In development**.
