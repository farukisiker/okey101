# Test deployment of the game server (Cloud Run), E2. Build context = the REPO ROOT (it needs shared/ and packages/):
#   docker build -f server/Dockerfile -t kahve-server .
#   or: gcloud builds submit --config server/cloudbuild.yaml .   (from the repo root)
# Tables live in memory: they are lost when the instance stops. Cloud Run needs session affinity and max 1 instance
# (socket.io keeps state in the process).
# Env (names only, values are set at deploy time): PORT (Cloud Run sets it), BOT_DELAY_MS, TURN_TIMEOUT_MS,
# LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (missing -> voice:token answers not_configured).
# TABLE_PASS_SECRET (E2b, >= 32 chars, same value as the accounts server; missing -> no seat gets an accountId, no voice ban).
FROM node:24-slim
WORKDIR /srv
# The only third-party runtime packages (same versions as pnpm-lock.yaml); the workspace packages are plain TS run by tsx.
RUN npm install --no-save --no-audit --no-fund express@5.3.0 socket.io@4.8.4 tsx@4.23.15
COPY packages/game-core/package.json node_modules/@kahve/core/package.json
COPY packages/game-core/src node_modules/@kahve/core/src
COPY packages/cards/package.json node_modules/@kahve/cards/package.json
COPY packages/cards/src node_modules/@kahve/cards/src
COPY packages/batak/package.json node_modules/@kahve/batak/package.json
COPY packages/batak/src node_modules/@kahve/batak/src
COPY packages/pisti/package.json node_modules/@kahve/pisti/package.json
COPY packages/pisti/src node_modules/@kahve/pisti/src
COPY packages/tavla/package.json node_modules/@kahve/tavla/package.json
COPY packages/tavla/src node_modules/@kahve/tavla/src
COPY packages/catalog/package.json node_modules/@kahve/catalog/package.json
COPY packages/catalog/src node_modules/@kahve/catalog/src
COPY shared/package.json node_modules/@okey/shared/package.json
COPY shared/src node_modules/@okey/shared/src
COPY server/package.json ./package.json
COPY server/src ./src
ENV NODE_ENV=production
USER node
CMD ["npx", "tsx", "src/index.ts"]
