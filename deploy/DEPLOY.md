# Deploying POLARIS to polaris.sarthxkz.in

Target: the Oracle VM at 161.153.37.106, which already serves `sarthxkz.in` through Caddy.
POLARIS runs as one Docker container bound to `127.0.0.1:3100`; the existing Caddy proxies
`polaris.sarthxkz.in` to it and issues the HTTPS certificate automatically.

## 1. DNS (GoDaddy, once)

In GoDaddy → DNS for `sarthxkz.in`, add:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `polaris` | `161.153.37.106` | 1 hour |

Check it has propagated: `nslookup polaris.sarthxkz.in 1.1.1.1` should answer 161.153.37.106.

## 2. Get the code onto the VM

```bash
# on the VM
sudo mkdir -p /opt/polaris && sudo chown "$USER" /opt/polaris
# from this PC (Git Bash), excluding build output:
#   tar --exclude=node_modules --exclude=.next --exclude=public/cesium --exclude=.git -czf polaris.tgz .
#   scp polaris.tgz <user>@161.153.37.106:/opt/polaris/
cd /opt/polaris && tar -xzf polaris.tgz && rm polaris.tgz
cp .env.example .env    # then edit: SITE_URL=https://polaris.sarthxkz.in, PROVIDER_CONTACT=...
```

## 3. Build and start

```bash
cd /opt/polaris
docker compose up -d --build
docker compose ps                     # STATUS should become "healthy" within a minute
curl -s http://127.0.0.1:3100/api/health
```

## 4. Caddy

Append `deploy/Caddyfile.polaris` to the VM's Caddyfile, then reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy           # or, if Caddy runs in Docker: docker exec <caddy> caddy reload --config /etc/caddy/Caddyfile
```

If Caddy itself runs in a Docker container, `127.0.0.1:3100` points at the Caddy container,
not the host. In that case attach POLARIS to Caddy's Docker network and proxy to `polaris:3000`.

Visit https://polaris.sarthxkz.in.

## Updating

```bash
cd /opt/polaris && <copy the new code as in step 2>
docker compose up -d --build          # rebuilds, then swaps the container
```

## Rollback

Before each update, tag the running image: `docker tag polaris:latest polaris:previous`.
To roll back: `docker tag polaris:previous polaris:latest && docker compose up -d --no-build`.

## Notes

- No database yet: the site runs from live providers with in-memory caches; the CelesTrak
  cache persists in the `polaris-cache` volume. PostgreSQL + PostGIS for stored history is the
  next phase and will join this compose file.
- Port 3100 is bound to localhost only; nothing new is opened in the Oracle firewall.
- Memory: the container is capped at 1 GB; the build needs about 2 GB free.
