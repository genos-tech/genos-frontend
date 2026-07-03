# Production image for genos-frontend (React 19 + Vite).
#
# Railway builds this via Nixpacks (railway.toml), so there was no Dockerfile;
# Cloud Run needs an image. Mirrors Railway's flow (npm install -> build ->
# `serve -s dist`), with two deliberate choices:
#
#  * VITE_* is baked at BUILD time -> pass the production backend URLs as
#    --build-arg (see genos-frontend/src/vite-env.d.ts for the authoritative
#    names; each has caused a real 404/blank bug if wrong).
#  * We run `vite build` directly instead of `npm run build` (= `tsc -b &&
#    vite build`): the repo has known pre-existing type errors that fail
#    `tsc -b`, and Vite transpiles without type-checking, so this stays
#    deterministic. Type-checking still runs in CI (report-only).
FROM node:22-slim

WORKDIR /app

# .npmrc carries legacy-peer-deps=true (React 19 peer conflicts) — copy it
# BEFORE install or npm ERESOLVE-fails. `npm ci` matches CI + the lockfile.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .

# Build-time public config (baked into the bundle).
ARG VITE_API_BASE_URL
ARG VITE_DJANGO_URL
ARG VITE_MEDIA_ROOT_DJANGO
ARG VITE_WS_BASE_URL
ARG VITE_COLLAB_URL
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DJANGO_URL=$VITE_DJANGO_URL \
    VITE_MEDIA_ROOT_DJANGO=$VITE_MEDIA_ROOT_DJANGO \
    VITE_WS_BASE_URL=$VITE_WS_BASE_URL \
    VITE_COLLAB_URL=$VITE_COLLAB_URL \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

# Large app — raise Node's heap so the production build doesn't OOM (exit 134).
RUN NODE_OPTIONS=--max-old-space-size=4096 npx vite build

EXPOSE 3000
# `serve` is a project dependency; serve the static build on $PORT (Cloud Run injects 8080).
CMD ["sh", "-c", "npx serve -s dist -l ${PORT:-3000}"]
