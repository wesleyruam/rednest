# RedNest V2 — API (NestJS + Prisma) — build multi-stage

# ── Stage 1: build (devDeps + compilação) ──────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ── Stage 2: runtime (só prod deps + dist) ─────────────────────────────────────
FROM node:22-bookworm-slim
# holehe (OSINT de e-mail) + GHunt (Google Intelligence) + Python
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && pip3 install --no-cache-dir --break-system-packages holehe ghunt \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
# GHunt guarda credenciais sob $HOME — diretório dedicado e gravável
ENV HOME=/app/.ghunt-home
RUN mkdir -p /app/.ghunt-home

COPY package*.json ./
RUN npm ci --omit=dev
# Chromium do Playwright (Screenshot Engine) + libs de sistema
RUN npx playwright install --with-deps chromium
COPY prisma ./prisma
RUN npx prisma generate
COPY docker-entrypoint.sh ./
COPY scripts ./scripts
COPY --from=builder /app/dist ./dist
RUN chmod +x docker-entrypoint.sh

EXPOSE 3333
CMD ["./docker-entrypoint.sh"]
