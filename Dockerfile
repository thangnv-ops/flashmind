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

# Build-time env vars — values are supplied via docker-compose build.args
# which reads from the .env file on the host. Nothing is hardcoded here.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MINIO_ENDPOINT
ARG VITE_MINIO_ACCESS_KEY
ARG VITE_MINIO_SECRET_KEY
ARG VITE_MINIO_BUCKET
ARG VITE_MINIO_REGION

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_MINIO_ENDPOINT=$VITE_MINIO_ENDPOINT \
    VITE_MINIO_ACCESS_KEY=$VITE_MINIO_ACCESS_KEY \
    VITE_MINIO_SECRET_KEY=$VITE_MINIO_SECRET_KEY \
    VITE_MINIO_BUCKET=$VITE_MINIO_BUCKET \
    VITE_MINIO_REGION=$VITE_MINIO_REGION

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 4173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
