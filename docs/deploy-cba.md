# Deploying to the CBA server

The platform runs at **https://exams.cba.org.bo** on the CBA server
(CentOS Stream 9, `ns1.cba.org.bo`, 181.188.144.150).

That server is **shared**: it already hosts www.cba.org.bo, a dozen other
`*.cba.org.bo` sites, a PostgreSQL, several Node apps and the domain's only DNS
server. Every step below is additive. Do not edit `/etc/nginx/nginx.conf` or any
other site, and never `systemctl restart nginx` — use `nginx -t && systemctl reload nginx`.

```
browser ──https──▶ host nginx :443 ──http──▶ 127.0.0.1:8088 api-gateway (Docker)
                   (TLS, certbot)            └─▶ frontend, services, /minio/
```

Only the gateway is published, and only on the loopback interface
(`docker-compose.prod.yml`). Docker bypasses firewalld, so publishing
Mongo, Redis, Kafka or MinIO would expose them to the internet.

## One-time setup

### 1. DNS

`exams IN A 181.188.144.150` is in `/var/named/named.cba.org.bo`. It was added
on 2026-09-26, and the backup is `named.cba.org.bo.bak-2026-09-26`.

To change the zone:

1. Bump the serial.
2. Run `named-checkzone cba.org.bo /var/named/named.cba.org.bo`.
3. Run `rndc reload cba.org.bo`.

Run `timeout 8 rndc status` **first**. If it hangs, named's control channel is
stuck, and a reload will need `systemctl restart named`. That restart cannot
stop cleanly and cuts DNS for about 90 s, so do it in a quiet window.

### 2. Docker

Podman is installed but unused. It runs on `crun`, and `docker-ce` brings its
own `containerd.io`/`runc`. Review the transaction before confirming it.

```bash
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version   # must be >= 2.24.4 (docker-compose.prod.yml uses !reset)
```

### 3. Code and environment

```bash
git clone https://github.com/olivio-git/<repo>.git /opt/cba-exams
cd /opt/cba-exams
cp .env.template .env && chmod 600 .env
```

Fill in `.env` on the server. Secrets never go through chat or git.
Production-specific values:

| Key | Value |
|---|---|
| `CORS_ORIGIN` | `https://exams.cba.org.bo` |
| `MINIO_PUBLIC_URL` | `https://exams.cba.org.bo/minio` |
| `GATEWAY_PORT` | `8088` |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SERVICE_TOKEN`, `REDIS_PASSWORD`, `MONGO_ROOT_PASSWORD`, `MINIO_ROOT_PASSWORD` | fresh values: `openssl rand -hex 32` |
| `GROQ_API_KEY`, `RESEND_API_KEY` | the real keys |

### 4. Build and start

Build **one service at a time**. Parallel builds have failed before and left the stack down.

```bash
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
for s in frontend identity-service notifications-service grading-service exam-service session-manager-service api-gateway; do
  $C build "$s" || break
done
$C up -d
$C ps
curl -sf http://127.0.0.1:8088/ >/dev/null && echo gateway ok
```

### 5. TLS certificate and nginx site

The full site file points at a certificate that does not exist yet, so it
cannot be enabled first. Bootstrap with a port-80-only block, get the
certificate, then swap in the real file.

```bash
cp -a /etc/nginx /root/nginx.bak-$(date +%F)

# a) HTTP-only block, so certbot has a server_name to answer the challenge on.
cat > /etc/nginx/sites-available/exams <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name exams.cba.org.bo;
    location / { return 404; }
}
EOF
ln -s /etc/nginx/sites-available/exams /etc/nginx/sites-enabled/exams
nginx -t && systemctl reload nginx

# b) Certificate only; certbot reverts its temporary challenge config.
certbot certonly --nginx -d exams.cba.org.bo

# c) The real site (redirect + TLS proxy to the gateway).
cp deploy/cba/exams.cba.org.bo.conf /etc/nginx/sites-available/exams
nginx -t && systemctl reload nginx
curl -sI https://exams.cba.org.bo | head -1
```

Renewal is handled by the server's existing certbot timer.

## Updating

```bash
cd /opt/cba-exams && git pull --ff-only
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$C build <changed-service> && $C up -d <changed-service>
```

## Rollback

| What | How |
|---|---|
| nginx site | `rm /etc/nginx/sites-enabled/exams && nginx -t && systemctl reload nginx` |
| Stack | `$C down` (data stays in `./data`) |
| Code | `git checkout <previous-sha>`, rebuild the affected services |
| DNS record | restore `named.cba.org.bo.bak-2026-09-26` and reload the zone |
