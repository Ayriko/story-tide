# syntax=docker/dockerfile:1

# Image multi-stage : deux cibles applicatives (app Next.js autonome, worker
# pg-boss) construites depuis la meme base, en node:*-slim, executees non-root.
# La cible se choisit au build : `docker build --target app` / `--target worker`.
# node 24-slim (Debian/glibc, Active LTS) : satisfait pg-boss (>=22.12), aligne
# sur le dev local ; Debian plutot qu'Alpine car Prisma 7 + driver adapter reste
# fragile sur musl (cf. ADR-0008).

FROM node:24-slim AS base
WORKDIR /app

# --- Dependances completes (dev incluses) pour construire ---
FROM base AS deps
# postinstall = `prisma generate`, qui exige DATABASE_URL resolue (via
# prisma.config.ts). Placeholder build-only, passe inline au RUN pour ne pas le
# figer dans une couche ENV (les vraies valeurs arrivent au runtime).
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    npm ci --include=dev

# --- Build de l'app Next.js (sortie standalone) ---
FROM deps AS builder
COPY . .
# `next build` importe src/env.ts (validation Zod) : placeholders non-secrets,
# inline (build uniquement).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    BETTER_AUTH_SECRET="build-placeholder-secret-at-least-32-characters" \
    BETTER_AUTH_URL="http://localhost:3000" \
    S3_ENDPOINT="localhost" S3_PORT="9000" S3_USE_SSL="false" \
    S3_REGION="us-east-1" S3_ACCESS_KEY="build" S3_SECRET_KEY="build-placeholder" \
    S3_BUCKET="build" \
    npm run build

# --- Dependances de production seules (pour l'image worker) ---
FROM base AS prod-deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    npm ci --omit=dev

# --- Cible 1 : app Next.js ---
FROM base AS app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Sortie standalone : serveur + dependances tracees seulement.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# --- Cible 2 : worker pg-boss (moteur de liaison, execute via tsx) ---
FROM base AS worker
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node src ./src
# Client Prisma genere (gitignore/dockerignore) : repris du stage prod-deps.
COPY --from=prod-deps --chown=node:node /app/src/generated ./src/generated
USER node
# node est PID 1 (tsx en loader) : SIGTERM arrive directement au handler d'arret
# gracieux du worker, contrairement a `npm run` qui ne relaie pas le signal.
CMD ["node", "--import", "tsx", "src/worker/index.ts"]

# --- Cible 3 : migrations Prisma (one-shot, execute par le CD avant app/worker) ---
FROM deps AS migrate
ENV NODE_ENV=production
USER node
CMD ["npx", "prisma", "migrate", "deploy"]
