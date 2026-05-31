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

## 4. DNS

Point the A record for `scrimflow.com` to the VPS IP. DNS must resolve before starting the stack — Caddy uses HTTP-01 ACME on first boot.

```bash
dig +short scrimflow.com
```

---

## 5. Deploy

```bash
cd /home/deploy
git clone https://github.com/Simon-Fontaine/scrimflow.git scrimflow
cd scrimflow
cp .env.production.example .env.production
nano .env.production
```

Fill every `change_me_*` value. See [`production-env.md`](production-env.md) for variable descriptions. Key secrets:

| Variable | How to generate |
|---|---|
| `DB_PASSWORD` | `openssl rand -hex 24` |
| `REDIS_PASSWORD` | `openssl rand -hex 24` |
| `MINIO_PASSWORD` | `openssl rand -hex 24` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | `openssl rand -base64 32` |

---

## 6. Database Bootstrap

On the very first deploy, migrations run automatically via the `db-migrate` service when you bring the stack up (see Section 7). For subsequent deploys after a code update that includes schema changes, run migrations explicitly:

```bash
docker compose -f docker-compose.prod.yml run --rm db-migrate
```

This runs `bunx drizzle-kit migrate` against the production database inside the API image. The command exits 0 on success. Run it before restarting the API and worker services to avoid serving code against a stale schema.

---

## 7. First Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds the images, runs migrations via `db-migrate`, initialises MinIO buckets via `storage-init`, and starts all services. Caddy obtains the TLS certificate on first request to port 80.

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
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
docker compose -f docker-compose.prod.yml build api app worker
docker compose -f docker-compose.prod.yml up -d --no-deps api app worker
```

If the update includes migrations:

```bash
docker compose -f docker-compose.prod.yml run --rm db-migrate
```

### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f [service]
```

### Postgres backup

```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U $DB_USER $DB_NAME | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

Restore:

```bash
gunzip -c backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U $DB_USER $DB_NAME
```

### MinIO backup

```bash
docker run --rm \
  --network scrimflow_network \
  -e MC_HOST_scrimflow="http://${MINIO_USER}:${MINIO_PASSWORD}@storage:9000" \
  -v /home/deploy/minio-backup:/backup \
  minio/mc mirror scrimflow/ /backup/
```
