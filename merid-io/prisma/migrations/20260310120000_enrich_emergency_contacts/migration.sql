-- Migration: enrich_emergency_contacts
-- Safe: additive changes only (new nullable columns + rename column)
-- Zero-downtime compatible

-- Rename relationship -> relation (preserves data)
ALTER TABLE "EmergencyContact" RENAME COLUMN "relationship" TO "relation";

-- Add new nullable columns
ALTER TABLE "EmergencyContact" ADD COLUMN "mobile" TEXT;
ALTER TABLE "EmergencyContact" ADD COLUMN "address" TEXT;
