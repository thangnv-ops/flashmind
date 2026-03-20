#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Replace build-time placeholder strings in the compiled JS bundle with
# real values from environment variables.
# This lets us "build once, deploy anywhere" without baking secrets into
# the image.
# ---------------------------------------------------------------------------

DIST=/app/dist

replace() {
  local placeholder="$1"
  local value="$2"
  find "$DIST" -name "*.js" -exec sed -i "s|${placeholder}|${value}|g" {} +
}

replace "PLACEHOLDER_APP_URL"            "${VITE_APP_URL}"
replace "PLACEHOLDER_SUPABASE_URL"       "${VITE_SUPABASE_URL}"
replace "PLACEHOLDER_SUPABASE_ANON_KEY"  "${VITE_SUPABASE_ANON_KEY}"
replace "PLACEHOLDER_MINIO_ENDPOINT"     "${VITE_MINIO_ENDPOINT:-}"
replace "PLACEHOLDER_MINIO_ACCESS_KEY"   "${VITE_MINIO_ACCESS_KEY:-}"
replace "PLACEHOLDER_MINIO_SECRET_KEY"   "${VITE_MINIO_SECRET_KEY:-}"
replace "PLACEHOLDER_MINIO_BUCKET"       "${VITE_MINIO_BUCKET:-flashmind}"
replace "PLACEHOLDER_MINIO_REGION"       "${VITE_MINIO_REGION:-us-east-1}"

exec node_modules/.bin/vite preview --host 0.0.0.0 --port 4173
