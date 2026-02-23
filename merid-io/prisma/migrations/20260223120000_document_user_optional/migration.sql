-- AlterTable: make userId optional on Document (allows unassigned documents for HR)
ALTER TABLE "Document" ALTER COLUMN "userId" DROP NOT NULL;
