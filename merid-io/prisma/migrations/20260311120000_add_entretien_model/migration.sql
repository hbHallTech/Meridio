-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "EntretienStatus" AS ENUM ('DRAFT_EMPLOYEE', 'DRAFT_MANAGER', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Entretien" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "EntretienStatus" NOT NULL DEFAULT 'DRAFT_EMPLOYEE',

    "selfSkills" JSONB,
    "selfObjectives" JSONB,
    "selfStrengths" TEXT,
    "selfImprovements" TEXT,

    "managerSkills" JSONB,
    "managerObjectives" JSONB,
    "managerStrengths" TEXT,
    "managerImprovements" TEXT,

    "summaryReport" TEXT,
    "finalComment" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entretien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Entretien_userId_year_key" ON "Entretien"("userId", "year");
CREATE INDEX IF NOT EXISTS "Entretien_userId_idx" ON "Entretien"("userId");
CREATE INDEX IF NOT EXISTS "Entretien_managerId_idx" ON "Entretien"("managerId");
CREATE INDEX IF NOT EXISTS "Entretien_year_idx" ON "Entretien"("year");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "Entretien" ADD CONSTRAINT "Entretien_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Entretien" ADD CONSTRAINT "Entretien_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
