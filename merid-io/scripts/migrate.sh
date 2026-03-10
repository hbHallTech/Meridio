#!/bin/bash
# Safe migration script for transitioning from "db push" to "migrate deploy".
#
# Problem: Production was using "prisma db push" which doesn't track migrations.
# Solution: Mark existing migrations as applied, then run new ones.
#
# This script:
# 1. Checks if _prisma_migrations table exists
# 2. If not (first run after transition), creates it and marks all pre-existing
#    migrations as already applied via "prisma migrate resolve"
# 3. Then runs "prisma migrate deploy" for any new/pending migrations

set -e

echo "=== Meridio Migration Script ==="

# List of migrations that were already applied via db push (before we switched to migrate deploy).
# These correspond to the schema state that was already in production.
BASELINE_MIGRATIONS=(
  "20260210064059_init"
  "20260210064436_add_auth_fields"
  "20260222150000_add_imap_config"
  "20260223120000_document_user_optional"
  "20260224120000_add_cin_cnss_to_user"
)

# Check if _prisma_migrations table exists
TABLE_EXISTS=$(npx prisma migrate status 2>&1 || true)

if echo "$TABLE_EXISTS" | grep -q "Database schema is not in sync"; then
  echo ">> Transitioning from db push to migrate deploy..."
  echo ">> Marking baseline migrations as applied..."

  for migration in "${BASELINE_MIGRATIONS[@]}"; do
    echo "   Resolving: $migration"
    npx prisma migrate resolve --applied "$migration" 2>/dev/null || true
  done

  echo ">> Baseline migrations marked. Running pending migrations..."
fi

# Run any pending migrations
echo ">> Running prisma migrate deploy..."
npx prisma migrate deploy

echo "=== Migration complete ==="
