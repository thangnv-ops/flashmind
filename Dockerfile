# ─────────────────────────────────────────────
# Build + serve (single stage)
# ─────────────────────────────────────────────
FROM node:22-bookworm-slim

# Patch OS-level CVEs in the base image
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy placeholder env so Vite has VITE_* keys at build time (no real secrets).
# docker-entrypoint.sh replaces the placeholder strings at container start.
COPY .env.example .env.local

COPY . .
RUN npm run build && rm -f .env.local

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 4173

ENTRYPOINT ["/docker-entrypoint.sh"]
