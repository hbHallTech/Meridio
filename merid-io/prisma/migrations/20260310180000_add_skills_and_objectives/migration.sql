-- Migration: add_skills_and_objectives
-- SAFE: Purely additive — new enums, new tables, new indexes.
-- Zero-downtime: no existing table modified, no column renamed/dropped.
-- User model gets virtual relations only (no DB column change).

-- Create enums
CREATE TYPE "SkillType" AS ENUM ('TECHNICAL', 'SOFT', 'BEHAVIORAL', 'OTHER');
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
CREATE TYPE "ObjectiveStatus" AS ENUM ('IN_PROGRESS', 'ACHIEVED', 'PARTIALLY_ACHIEVED', 'NOT_ACHIEVED', 'CANCELLED');

-- Create Skill table
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SkillType" NOT NULL,
    "selfLevel" "SkillLevel",
    "managerLevel" "SkillLevel",
    "description" TEXT,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one skill name per user
CREATE UNIQUE INDEX "Skill_userId_name_key" ON "Skill"("userId", "name");
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");

-- Create Objective table
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "progress" INTEGER DEFAULT 0,
    "selfComment" TEXT,
    "managerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Objective_userId_idx" ON "Objective"("userId");
CREATE INDEX "Objective_userId_status_idx" ON "Objective"("userId", "status");
CREATE INDEX "Objective_managerId_idx" ON "Objective"("managerId");

-- Foreign keys
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Objective" ADD CONSTRAINT "Objective_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Objective" ADD CONSTRAINT "Objective_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
