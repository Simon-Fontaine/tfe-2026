# tfe-2026

[![CI](https://github.com/Simon-Fontaine/tfe-2026/actions/workflows/ci.yml/badge.svg)](https://github.com/Simon-Fontaine/tfe-2026/actions/workflows/ci.yml) ![GitHub last commit](https://img.shields.io/github/last-commit/Simon-Fontaine/tfe-2026) ![GitHub Repo stars](https://img.shields.io/github/stars/Simon-Fontaine/tfe-2026)

## Prerequisites

- Bun `1.3.3` or higher

## Setup

Install dependencies:

```bash
bun install
```

## Environment

- Copy .env.example to .env and fill DATABASE_URL, RESEND_API_KEY, and any Docker compose variables you use.
- The root .env is shared by all workspaces; add .env.local for machine-specific overrides.
- Environment variables are validated via @workspaces/shared/env, so missing or malformed values fail fast at startup.

## Common commands

```bash
# dev (all workspaces)
bun run dev

# checks (lint + formatting)
bun run check
bun run fix

# types
bun run typecheck

# build
bun run build

# CI equivalent (format + lint + typecheck + build)
bun run ci
```

## Hooks

- Pre-commit runs Biome on staged files (auto-fixes and restages).
- Pre-push runs `check` + `typecheck`.
