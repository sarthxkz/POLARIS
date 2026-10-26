#!/usr/bin/env bash
# Installs or updates POLARIS on the VM, following the portfolio's pattern.
# Usage (on the VM): bash ~/polaris/install.sh   (with polaris.tgz uploaded to ~/polaris)
set -euo pipefail

APP="$HOME/polaris"
SITES="$HOME/vybe/deploy/sites"
CADDY=vybe-caddy-1
cd "$APP"

[ -f polaris.tgz ] || { echo "Upload polaris.tgz to $APP first." >&2; exit 1; }
docker network inspect vybe_edge >/dev/null || { echo "Vybe's edge network is missing." >&2; exit 1; }

# Keep the running image for rollback before replacing anything.
docker image inspect polaris:latest >/dev/null 2>&1 && docker tag polaris:latest polaris:previous || true

tar -xzf polaris.tgz && rm polaris.tgz
[ -f .env ] || cp .env.example .env

docker compose up -d --build

echo "Waiting for the health check..."
for _ in $(seq 1 40); do
  status=$(docker inspect --format '{{.State.Health.Status}}' polaris-polaris-1 2>/dev/null || echo none)
  [ "$status" = healthy ] && break
  sleep 3
done
if [ "$status" != healthy ]; then
  echo "POLARIS did not become healthy ($status); recent logs:" >&2
  docker compose logs --tail 60 polaris >&2
  exit 1
fi
echo "POLARIS is healthy."

# Publish the site to Caddy: validate the whole config first, so a mistake never reaches the live proxy.
cp deploy/polaris.caddy "$SITES/polaris.caddy"
if docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile
  echo "Caddy reloaded: https://polaris.sarthxkz.in"
else
  rm "$SITES/polaris.caddy"
  echo "Caddy rejected the site file; removed it and left Caddy unchanged." >&2
  docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile >&2 || true
  exit 1
fi
