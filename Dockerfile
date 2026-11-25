# syntax=docker/dockerfile:1
# Monorepo image: @fhir-hub/hub-api + @fhir-hub/shared (production dependencies only in final layer).
# Run with env from your secret store — never bake secrets into the image.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages
COPY services ./services
COPY db ./db
COPY scripts/apply-all-migrations.mjs ./scripts/apply-all-migrations.mjs

ENV NODE_ENV=development
RUN npm ci
RUN npm run build -w @fhir-hub/shared -w @fhir-hub/hub-api
RUN npm prune --omit=dev

# ---

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Default listen (override with HUB_API_HOST / HUB_API_PORT)
ENV HUB_API_HOST=0.0.0.0
ENV HUB_API_PORT=3000

RUN addgroup -g 1001 -S hub && adduser -S -D -H -u 1001 -G hub hub

COPY --from=build --chown=hub:hub /app /app

USER hub
EXPOSE 3000

# Writable tmp for Node / uv — required if orchestrator sets read-only root filesystem (mount emptyDir/tmpfs on /tmp).
# HEALTHCHECK uses default port; override if HUB_API_PORT changes at runtime (prefer orchestrator probes).

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "services/hub-api/dist/index.js"]
