/*
  Warnings:

  - You are about to drop the column `contact` on the `Supplier` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "contact",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "loanBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "nic" TEXT;
