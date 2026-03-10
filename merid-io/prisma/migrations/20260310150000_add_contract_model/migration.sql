-- Migration: add_contract_model
-- SAFE: Purely additive — new enums, new table, new indexes.
-- Zero-downtime: no existing table altered, no column renamed/dropped.
-- User model gets new virtual relations only (no DB column change).

-- Create enums
CREATE TYPE "ContractType" AS ENUM ('CDI', 'CDD', 'SIVP', 'STAGE', 'ALTERNANCE', 'FREELANCE', 'AUTRE');
CREATE TYPE "ContractStatus" AS ENUM ('ACTIF', 'TERMINE', 'SUSPENDU', 'EN_PROLONGATION', 'EN_ATTENTE_SIGNATURE');

-- Create Contract table
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'EN_ATTENTE_SIGNATURE',
    "contractNumber" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "trialPeriodEnd" TIMESTAMP(3),
    "weeklyHours" DOUBLE PRECISION,
    "salaryGrossMonthly" DOUBLE PRECISION,
    "salaryGrossHourly" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "paymentFrequency" TEXT,
    "paymentMethod" TEXT,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT,
    "managerId" TEXT,
    "conventionCollective" TEXT,
    "location" TEXT,
    "remoteAllowed" BOOLEAN NOT NULL DEFAULT false,
    "remotePercentage" INTEGER,
    "notes" TEXT,
    "documentId" TEXT,
    "createdBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- Indexes for performance
CREATE INDEX "Contract_userId_idx" ON "Contract"("userId");
CREATE INDEX "Contract_userId_status_idx" ON "Contract"("userId", "status");
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- Foreign keys
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
