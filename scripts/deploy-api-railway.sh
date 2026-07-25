#!/usr/bin/env bash
# ── Deploy NestJS API to Railway + import local DB ──────────────────────────
# Run from repo root AFTER: railway login
# Usage: bash scripts/deploy-api-railway.sh

set -e

echo ""
echo "🚂  Sozialzync API → Railway"
echo ""

# ── 1. Create Railway project ────────────────────────────────────────────────
echo "Creating Railway project 'sozialzync-api'..."
railway init --name sozialzync-api

# ── 2. Add PostgreSQL service ─────────────────────────────────────────────────
echo "Adding PostgreSQL..."
railway add --plugin postgresql

# ── 3. Add Redis service ───────────────────────────────────────────────────────
echo "Adding Redis..."
railway add --plugin redis

# ── 4. Set env variables on Railway ──────────────────────────────────────────
echo ""
echo "Setting environment variables..."
echo "  (Copy values from your local .env file)"

# Pull existing Vercel env to get secrets
if [ -f .env ]; then
  source .env 2>/dev/null || true
fi

# Core variables the NestJS API needs
railway variables set \
  NODE_ENV=production \
  PORT=4007 \
  API_PREFIX=/api/v1

# Auth (copy from your .env)
railway variables set \
  JWT_SECRET="${JWT_SECRET:-CHANGE_ME}" \
  JWT_EXPIRY="${JWT_EXPIRY:-7d}" \
  TOKEN_ENCRYPTION_KEY="${TOKEN_ENCRYPTION_KEY:-CHANGE_ME}"

# AI providers (copy from your .env)
railway variables set \
  ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
  OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
  GEMINI_API_KEY="${GEMINI_API_KEY:-}"

# YouTube / OAuth
railway variables set \
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
  YOUTUBE_API_KEY="${YOUTUBE_API_KEY:-}"

# Web URL for CORS
railway variables set \
  WEB_URL="https://sozialzync.vercel.app" \
  NEXTAUTH_URL="https://sozialzync.vercel.app"

echo ""
echo "✓  Environment variables set"

# ── 5. Deploy the API ─────────────────────────────────────────────────────────
echo ""
echo "Deploying NestJS API from apps/api/..."
cd apps/api
railway up --detach
cd ../..

echo ""
echo "⏳  Waiting for deploy to complete (60s)..."
sleep 60

# ── 6. Get the Railway API URL ─────────────────────────────────────────────────
echo ""
API_URL=$(railway domain 2>/dev/null || echo "")
echo "Railway API URL: $API_URL"

# ── 7. Import local database dump ────────────────────────────────────────────
echo ""
echo "Importing local database dump (27MB)..."
RAILWAY_DB_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")

if [ -n "$RAILWAY_DB_URL" ]; then
  if command -v pg_restore &>/dev/null; then
    psql "$RAILWAY_DB_URL" < local-db-export.sql
    echo "✓  Database imported"
  else
    # Try Windows pg path
    PG_BIN="C:/Program Files/PostgreSQL/16/bin"
    "$PG_BIN/psql.exe" "$RAILWAY_DB_URL" < local-db-export.sql
    echo "✓  Database imported"
  fi
else
  echo "⚠  Could not get DATABASE_URL from Railway. Import manually:"
  echo "   psql \$DATABASE_URL < local-db-export.sql"
fi

# ── 8. Update Vercel env vars ─────────────────────────────────────────────────
echo ""
echo "Updating Vercel environment variables..."

if [ -n "$API_URL" ]; then
  vercel env rm NEXT_PUBLIC_API_URL production --yes 2>/dev/null || true
  echo "https://$API_URL/api/v1" | vercel env add NEXT_PUBLIC_API_URL production
fi

# Turn off mock mode
vercel env rm NEXT_PUBLIC_USE_MOCK production --yes 2>/dev/null || true
echo "false" | vercel env add NEXT_PUBLIC_USE_MOCK production

echo ""
echo "✅  Done! Redeploy Vercel to pick up new env vars:"
echo "   vercel --prod --yes"
echo ""
echo "Your account ethonanpasumvalki@gmail.com data is now on production."
