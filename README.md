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
docker compose -f docker-compose.dev.yml up db cache storage storage-init -d

# Run app
cd next-app
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

## Stack

Next.js 16, TypeScript, PostgreSQL, Redis, MinIO, Caddy

## License

GNU Affero General Public License Version 3
