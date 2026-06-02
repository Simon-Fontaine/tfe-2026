# Scrimflow — Deployment Runbook

Ubuntu 22.04 LTS, single VPS. Caddy handles HTTPS automatically via Let's Encrypt.

---

## 1. Server Requirements

| Resource | Minimum |
|---|---|
| OS | Ubuntu 22.04 LTS |
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disk | 40 GB SSD |
| Ports (inbound) | 22, 80, 443 |

Ports 5432, 6379, 9000, 9001, 3000, 3001 must stay closed — all internal traffic uses the Docker bridge network.

---

## 2. Initial Server Setup

```bash
adduser deploy
usermod -aG sudo deploy
```

From your local machine, copy your SSH key:

```bash
ssh-copy-id deploy@<server-ip>
```

Harden SSH — edit `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart sshd
```

Confirm `sudo` works as `deploy` before closing the root session.

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

These open `80`/`443` to the whole internet, which is correct for the initial
certificate issuance. Once the Cloudflare proxy is enabled, tighten them to
Cloudflare's IP ranges — see [Section 4](#4-dns--cloudflare).

Automatic security updates:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 3. Docker

Install the official Docker Engine (not the snap):

```bash
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and back in, then verify:

```bash
docker version && docker compose version
```

---

## 4. DNS & Cloudflare

Point the A record (and AAAA if you have IPv6) for `scrimflow.com` to the VPS IP. Add a `www` record too (a `CNAME www → scrimflow.com`, or its own A/AAAA) — Caddy redirects `www.scrimflow.com` to the apex, but the hostname must still resolve and reach the origin for that redirect to be served. DNS must resolve before starting the stack — Caddy uses HTTP-01 ACME on first boot.

```bash
dig +short scrimflow.com
dig +short www.scrimflow.com
```

### 4.1 Enable the proxy (orange cloud)

Bring the stack up with the record **DNS-only (grey cloud)** first so Caddy can complete the HTTP-01 challenge and obtain its Let's Encrypt certificate (Section 7). Once `https://scrimflow.com` serves correctly, switch the record to **Proxied (orange cloud)** in the Cloudflare dashboard, then set **SSL/TLS → Overview → Full (strict)** so Cloudflare validates Caddy's origin certificate end-to-end.

### 4.2 Why the origin must be locked to Cloudflare

With the proxy on, the app resolves the client IP from the `cf-connecting-ip` header (`getClientIp` in `packages/api/src/auth/device.ts`). That header is only trustworthy if requests can reach the origin **exclusively through Cloudflare** — otherwise an attacker who hits the VPS IP directly can forge `cf-connecting-ip` (and `x-forwarded-for`), which would let them evade the IP-based login/registration rate limits and poison geolocation and new-device/new-location detection.

The fix is a firewall that only accepts `80`/`443` from Cloudflare's published ranges.

### 4.3 Restrict 80/443 to Cloudflare

Replace the open `80`/`443` rules from Section 2 with Cloudflare-only rules:

```bash
# Cloudflare IP ranges — verify the current list at https://www.cloudflare.com/ips/
# (machine-readable: https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6)
CF_RANGES=(
  # IPv6
  2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32
  2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
  # IPv4
  173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22
  141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20
  197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13
  104.24.0.0/14 172.64.0.0/13 131.0.72.0/22
)

# Drop the internet-wide rules added during initial setup
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp

# Allow HTTP/HTTPS only from Cloudflare
for cidr in "${CF_RANGES[@]}"; do
  sudo ufw allow proto tcp from "$cidr" to any port 80,443 comment 'Cloudflare'
done

sudo ufw reload
sudo ufw status numbered
```

`ufw` applies the IPv6 rules only if IPv6 is enabled (`IPV6=yes` in `/etc/default/ufw`, the Ubuntu default). Leave the `OpenSSH` rule untouched so you keep direct SSH access.

> Cloudflare changes these ranges occasionally. Re-run this block (deleting the
> old `Cloudflare`-commented rules first) whenever the published list changes;
> consider a monthly cron that diffs `https://www.cloudflare.com/ips-v4`.

### 4.4 Caddy (optional)

The app trusts `cf-connecting-ip` directly, so no Caddy change is required for correct client-IP handling. If you also want Caddy's own access logs to attribute the real client IP (instead of the Cloudflare edge), add `trusted_proxies` with the same ranges to the site block in `deploy/caddy/Caddyfile`.

---

## 5. Deploy

```bash
cd /home/deploy
git clone https://github.com/Simon-Fontaine/scrimflow.git scrimflow
cd scrimflow
cp .env.production.example .env.production
nano .env.production
```

Every `docker compose` command below passes `--env-file .env.production` so Compose substitutes these values (it only auto-loads a file named `.env`).

Fill every `change_me_*` value. See [`production-env.md`](production-env.md) for variable descriptions. Key secrets:

| Variable | How to generate |
|---|---|
| `DB_PASSWORD` | `openssl rand -hex 24` |
| `REDIS_PASSWORD` | `openssl rand -hex 24` |
| `MINIO_PASSWORD` | `openssl rand -hex 24` |
| `ENCRYPTION_KEY` | `openssl rand -base64 16` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | `openssl rand -base64 32` |

---

## 6. Database Bootstrap

On the very first deploy, migrations run automatically via the `db-migrate` service when you bring the stack up (see Section 7). For subsequent deploys after a code update that includes schema changes, run migrations explicitly:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm db-migrate
```

This runs `bunx drizzle-kit migrate` against the production database inside the API image. The command exits 0 on success. Run it before restarting the API and worker services to avoid serving code against a stale schema.

---

## 7. First Start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This builds the images, runs migrations via `db-migrate`, initialises MinIO buckets via `storage-init`, and starts all services. Caddy obtains the TLS certificate on first request to port 80.

Check status:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

`db-migrate` and `storage-init` will show as exited with code 0 — that is expected.

---

## 8. Smoke Test

```bash
curl -I https://scrimflow.com
curl https://scrimflow.com/api/health
# Expected: {"status":"ok"}
```

Open `https://scrimflow.com`, create an account, confirm login and file uploads work.

---

## 9. Day-2 Operations

### Deploy an update

```bash
cd /home/deploy/scrimflow
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build api app worker
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps api app worker
```

If the update includes migrations:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm db-migrate
```

### Logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f [service]
```

### Postgres backup

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec db \
  pg_dump -U $DB_USER $DB_NAME | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

Restore:

```bash
gunzip -c backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db psql -U $DB_USER $DB_NAME
```

### MinIO backup

```bash
docker run --rm \
  --network scrimflow_network \
  -e MC_HOST_scrimflow="http://${MINIO_USER}:${MINIO_PASSWORD}@storage:9000" \
  -v /home/deploy/minio-backup:/backup \
  minio/mc mirror scrimflow/ /backup/
```
