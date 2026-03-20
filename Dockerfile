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

# Copy .env.local so Vite can read VITE_* vars at build time
COPY .env.example .env.local

COPY . .
RUN npm run build

# Remove secrets from final image after build
RUN rm -f .env.local

EXPOSE 4173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
