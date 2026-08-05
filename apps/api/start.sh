#!/bin/sh
set -e

PRISMA=/app/apps/api/node_modules/.bin/prisma
SCHEMA=/app/apps/api/prisma/schema.prisma

echo "=== start.sh: Migration fix ==="
"$PRISMA" migrate resolve --rolled-back 20260805000001_add_character_model \
  --schema "$SCHEMA" 2>&1 \
  || echo "Resolve warning (may already be clean or not needed)"

echo "=== start.sh: Migrate deploy ==="
"$PRISMA" migrate deploy --schema "$SCHEMA"

echo "=== start.sh: Starting NestJS ==="
exec node /app/apps/api/dist/main
