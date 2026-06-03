# Deployment Runbook

Ubuntu 22.04 LTS, single VPS, behind Cloudflare proxy. Cloudflare terminates TLS for visitors; Caddy serves a Cloudflare Origin certificate on the origin.

---

## 1. Server Requirements

| Resource | Minimum |
|---|---|
| OS | Ubuntu 22.04 LTS |
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disk | 40 GB SSD |
| Ports (inbound) | 22, 80, 443 |

Ports 5432, 6379, 9000, 9001, 3000, 3001 stay closed — all internal traffic uses the Docker bridge network.

---

## 2. Server Setup

```bash
adduser deploy
usermod -aG sudo deploy
```

From your local machine:

```bash
ssh-copy-id deploy@<server-ip>
```

Harden SSH (`/etc/ssh/sshd_config`):

```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart sshd
```

Firewall (temporarily open — tightened in Section 4):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Auto security updates:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 3. Docker

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

Point `scrimflow.com` and `www` A records to the VPS IP.

- Set both to **Proxied (orange cloud)**
- Set **SSL/TLS → Full (strict)**

### Origin certificate

In the Cloudflare dashboard: **SSL/TLS → Origin Server → Create Certificate**. Hostnames: `scrimflow.com` and `*.scrimflow.com`. Install on the server:

```bash
mkdir -p deploy/caddy/certs
nano deploy/caddy/certs/origin.pem      # paste Origin Certificate
nano deploy/caddy/certs/origin-key.pem  # paste Private Key
chmod 600 deploy/caddy/certs/origin-key.pem
```

### Restrict 80/443 to Cloudflare only

With the proxy on, `cf-connecting-ip` is the authoritative client IP. If the origin is reachable directly, that header can be forged — bypassing rate limits and device detection. Lock the firewall to Cloudflare's ranges:

```bash
CF_RANGES=(
  2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32
  2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
  173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22
  141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20
  197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13
  104.24.0.0/14 172.64.0.0/13 131.0.72.0/22
)

sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp

for cidr in "${CF_RANGES[@]}"; do
  sudo ufw allow proto tcp from "$cidr" to any port 80,443 comment 'Cloudflare'
done

sudo ufw reload
```

---

## 5. First Deploy

```bash
cd /home/deploy
git clone https://github.com/Simon-Fontaine/scrimflow.git scrimflow
cd scrimflow
cp .env.production.example .env.production
nano .env.production
```

Key secrets to generate:

| Variable | Command |
|---|---|
| `DB_PASSWORD` | `openssl rand -hex 24` |
| `REDIS_PASSWORD` | `openssl rand -hex 24` |
| `MINIO_PASSWORD` | `openssl rand -hex 24` |
| `ENCRYPTION_KEY` | `openssl rand -base64 16` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | `openssl rand -base64 32` |

Build and start everything:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

`db-migrate` runs migrations and `storage-init` creates MinIO buckets automatically on startup. Both will show as exited with code 0 — that is expected.

### Seed reference data and demo content

Wait for the API to be healthy, then:

```bash
# Heroes + maps (required)
docker compose --env-file .env.production -f docker-compose.prod.yml exec api bun src/db/seeds/index.ts

# Demo accounts and content (optional)
docker compose --env-file .env.production -f docker-compose.prod.yml exec api bun src/db/seeds/demo.ts
```

### Smoke test

```bash
curl -I https://scrimflow.com
curl https://scrimflow.com/api/health
# Expected: {"status":"ok"}
```

---

## 6. Day-2 Operations

### Deploy an update

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build api app worker
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps api app worker
```

If the update includes schema changes, run migrations before restarting:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm db-migrate
```

### Full reset (wipes all data)

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec api bun src/db/seeds/index.ts
docker compose --env-file .env.production -f docker-compose.prod.yml exec api bun src/db/seeds/demo.ts
```

### Logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f [service]
```

### Service status

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

### Restart a single service

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart [service]
```

### Shell into a container

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec [service] sh
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
