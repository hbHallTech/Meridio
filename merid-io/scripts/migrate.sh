#!/bin/bash
# Safe migration script for transitioning from "db push" to "migrate deploy".
#
# Problem: Production was using "prisma db push" which doesn't track migrations.
# The DB has tables but no _prisma_migrations table, so "migrate deploy" fails
# with P3005 ("database schema is not empty").
#
# Solution: Always attempt to baseline (idempotent), then deploy.

set -e

echo "=== Meridio Migration Script ==="

# Baseline migrations: these were already applied via db push.
# "prisma migrate resolve --applied" is idempotent — safe to re-run.
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

echo ">> Ensuring baseline migrations are marked as applied..."
for migration in "${BASELINE_MIGRATIONS[@]}"; do
  echo "   Resolving: $migration"
  npx prisma migrate resolve --applied "$migration" 2>&1 || true
done

echo ">> Running prisma migrate deploy for pending migrations..."
npx prisma migrate deploy

echo "=== Migration complete ==="
