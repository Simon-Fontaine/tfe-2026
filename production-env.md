# Production Environment Variables

Variables consumed by `docker-compose.prod.yml`. Keep real values in an uncommitted `.env.production` file.

Container-internal addresses use Docker service names (`http://api:3001`, `db:5432`, `cache:6379`, `http://storage:9000`). Browser-facing values must use the public HTTPS origin.

`APP_URL` is used by the API for email links. `NEXT_PUBLIC_APP_URL` is baked into the Next.js build — both must be set.

| Variable | Services | Required | Secret | Description |
|---|---|---|---|---|
| `DB_USER` | db, api, worker, db-migrate | yes | no | PostgreSQL user |
| `DB_PASSWORD` | db, api, worker, db-migrate | yes | yes | PostgreSQL password |
| `DB_NAME` | db, api, worker, db-migrate | yes | no | PostgreSQL database name |
| `REDIS_PASSWORD` | cache, api, worker | yes | yes | Redis `requirepass` value |
| `MINIO_USER` | storage, storage-init, api, worker | yes | no | MinIO root/access key |
| `MINIO_PASSWORD` | storage, storage-init, api, worker | yes | yes | MinIO root/secret key |
| `DOMAIN` | caddy | yes | no | Bare domain — Caddy uses this for automatic HTTPS (`scrimflow.com`) |
| `ACME_EMAIL` | caddy | optional | no | Email for Let's Encrypt renewal notices |
| `NODE_ENV` | api, app, worker | yes | no | Set to `production` by compose |
| `API_PORT` | api | yes | no | Hono API listen port (`3001`) |
| `API_URL` | app | yes | no | Internal API URL (`http://api:3001`) |
| `APP_URL` | api, app | yes | no | Public origin used in email links (`https://scrimflow.com`) |
| `NEXT_PUBLIC_APP_URL` | app, api | yes | no | Browser-visible public origin (`https://scrimflow.com`) |
| `DATABASE_URL` | api, worker, db-migrate | yes | yes | Full Postgres connection URL |
| `REDIS_URL` | api, worker | yes | yes | Full Redis connection URL |
| `LOG_LEVEL` | api, app, worker | optional | no | Log verbosity (`info`) |
| `SMTP_HOST` | api | yes | no | SMTP server hostname |
| `SMTP_PORT` | api | yes | no | SMTP port (`587`) |
| `SMTP_SECURE` | api | yes | no | Use implicit TLS immediately. Set `false` for port 587 STARTTLS, `true` for port 465 SMTPS |
| `SMTP_USER` | api | optional | yes | SMTP username |
| `SMTP_PASS` | api | optional | yes | SMTP password or token |
| `SMTP_FROM` | api | yes | no | From address (`noreply@scrimflow.com`) |
| `ENCRYPTION_KEY` | api | yes | yes | 16-byte key encoded as base64 for TOTP and recovery code encryption |
| `WEBAUTHN_RP_ID` | api | yes | no | WebAuthn relying party ID (`scrimflow.com`) |
| `WEBAUTHN_ORIGIN` | api | yes | no | WebAuthn origin (`https://scrimflow.com`) |
| `S3_ENDPOINT` | api, app, worker | yes | no | Internal MinIO endpoint (`http://storage:9000`) |
| `S3_ACCESS_KEY` | api, worker | yes | yes | S3 access key (same as `MINIO_USER`) |
| `S3_SECRET_KEY` | api, worker | yes | yes | S3 secret key (same as `MINIO_PASSWORD`) |
| `S3_PUBLIC_URL` | api, app, worker | yes | no | Public asset base URL (`https://scrimflow.com/assets`) |
| `S3_BUCKET_AVATARS` | storage-init, api, worker | yes | no | Avatar bucket name |
| `S3_BUCKET_SCREENSHOTS` | storage-init, api, worker | yes | no | Screenshot bucket name |
| `S3_BUCKET_BANNERS` | storage-init, api, worker | yes | no | Banner bucket name |
| `S3_BUCKET_HEROES` | storage-init, api, worker | yes | no | Hero image bucket name |
| `S3_BUCKET_MAPS` | storage-init, api, worker | yes | no | Map image bucket name |
| `GEMINI_API_KEY` | api, worker | yes | yes | Gemini API key for OCR |
| `GEMINI_MODEL` | api, worker | optional | no | Gemini model (`gemini-3-flash-preview`) |
| `GEMINI_RPM` | api, worker | optional | no | Requests per minute limit (`0` = unlimited) |
| `GEMINI_RPD` | api, worker | optional | no | Requests per day limit (`0` = unlimited) |
| `OCR_WORKER_POLL_INTERVAL_MS` | api, worker | optional | no | Worker poll interval ms (`4000`) |
| `OCR_WORKER_LEASE_SECONDS` | api, worker | optional | no | OCR job lease duration (`120`) |
| `OCR_WORKER_MAX_RETRIES` | api, worker | optional | no | OCR retry limit (`3`) |
| `OCR_WORKER_RETRY_BASE_MS` | api, worker | optional | no | Base retry delay ms (`30000`) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | app | optional | yes | Stable Server Actions encryption key — required for rolling deploys or multiple web containers |

## Notes

- Only Caddy exposes ports 80 and 443. All other services are internal to the Docker bridge network.
- `S3_PUBLIC_URL` is proxied through Caddy at `/assets/*` — MinIO is never directly exposed.
- `DATABASE_URL` and `REDIS_URL` are derived from the individual `DB_*` and `REDIS_PASSWORD` vars in compose. Both forms must be set consistently.
