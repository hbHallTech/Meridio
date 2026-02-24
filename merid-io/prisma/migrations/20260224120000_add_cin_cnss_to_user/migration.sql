-- AlterTable: Add CIN and CNSS fields for employee matching in document import
ALTER TABLE "User" ADD COLUMN "cin" TEXT;
ALTER TABLE "User" ADD COLUMN "cnss" TEXT;

-- CreateIndex: CIN must be unique (national ID card number)
CREATE UNIQUE INDEX "User_cin_key" ON "User"("cin");
