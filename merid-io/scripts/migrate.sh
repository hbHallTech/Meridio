#!/bin/bash
# Safe migration script for transitioning from "db push" to "migrate deploy".
#
# Strategy: Try "migrate deploy" first. If it succeeds (all migrations already
# baselined), we're done. If it fails with P3005 (no _prisma_migrations table),
# baseline all existing migrations and retry.
#
# This avoids exhausting Neon's connection pool with unnecessary resolve commands.

set -e

echo "=== Meridio Migration Script ==="

# Try migrate deploy first — this works when _prisma_migrations table exists
echo ">> Attempting prisma migrate deploy..."
if npx prisma migrate deploy 2>&1; then
  echo "=== Migration complete ==="
  exit 0
fi

echo ">> migrate deploy failed — baselining existing migrations..."

# Baseline migrations: these were already applied via db push.
BASELINE_MIGRATIONS=(
  "20260210064059_init"
  "20260210064436_add_auth_fields"
  "20260222150000_add_imap_config"
  "20260223120000_document_user_optional"
  "20260224120000_add_cin_cnss_to_user"
  "20260310120000_enrich_emergency_contacts"
  "20260310150000_add_contract_model"
  "20260310180000_add_skills_and_objectives"
)

for migration in "${BASELINE_MIGRATIONS[@]}"; do
  echo "   Resolving: $migration"
  npx prisma migrate resolve --applied "$migration" 2>&1 || true
  # Brief pause to avoid connection pool exhaustion on serverless DBs
  sleep 1
done

echo ">> Retrying prisma migrate deploy..."
npx prisma migrate deploy

echo "=== Migration complete ==="
