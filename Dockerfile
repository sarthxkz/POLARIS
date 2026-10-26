# POLARIS — production image (Next.js standalone server).
# Build: docker build -t polaris .   Run: see docker-compose.yml

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Install scripts stay off; the Cesium asset copy runs explicitly in `prebuild`.
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CACHE_DIR=/app/.cache
# Standalone server plus the static files it does not copy itself (incl. public/cesium).
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /app/.cache && chown node:node /app/.cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
