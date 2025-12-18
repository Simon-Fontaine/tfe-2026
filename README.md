# tfe-2026

## Prerequisites

- Bun `1.3.3` or higher

## Setup

Install dependencies:

```bash
bun install
```

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
