# Scrimflow

Overwatch 2 team management platform.

## Quick Start

```bash
docker compose -f docker-compose.dev.yml up -d
```

Access at <http://localhost:3000>

## Services

- PostgreSQL: localhost:5432
- Redis: localhost:6379
- MinIO API: localhost:9000
- MinIO Console: localhost:9001 (minio_admin / dev_minio_123)
- Redis Commander: localhost:8081

## Stop

```bash
docker compose -f docker-compose.dev.yml down
```

## Local Development

```bash
# Infrastructure only
docker compose -f docker-compose.dev.yml up db cache storage storage-init mail redis-commander -d

# Install deps and run the web app + API (from the repo root)
pnpm install
pnpm dev
```

## Database

```bash
# Generate migrations from schema changes
pnpm db:generate

# Run migrations (auto-runs in Docker)
pnpm db:migrate

# Push schema directly (dev only)
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

## Verification

```bash
# Lint + format (Biome)
pnpm lint
pnpm format

# Type-check every workspace package (web, api, shared)
pnpm typecheck

# Biome + typecheck + Drizzle schema check (requires the dev DB running)
pnpm check

# Production build (Next.js standalone output + API)
pnpm build
```

## Production Deployment

Production runs the full stack (PostgreSQL, Redis, MinIO, API, OCR worker, Next.js app, and a
Caddy reverse proxy) via `docker-compose.prod.yml`, behind the Cloudflare proxy.

- [deployment.md](deployment.md) — step-by-step production deployment runbook
- [.env.production.example](.env.production.example) — copy to `.env.production` and fill in secrets

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Stack

Next.js 16, TypeScript, PostgreSQL, Redis, MinIO, Caddy

## License

GNU Affero General Public License Version 3
