-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "docsImapHost" TEXT,
ADD COLUMN     "docsImapPort" INTEGER DEFAULT 993,
ADD COLUMN     "docsImapUser" TEXT,
ADD COLUMN     "docsImapPassEncrypted" TEXT,
ADD COLUMN     "docsImapSecure" BOOLEAN NOT NULL DEFAULT true;
