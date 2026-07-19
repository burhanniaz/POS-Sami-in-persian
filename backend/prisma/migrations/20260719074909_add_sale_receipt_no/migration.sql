/*
  Warnings:

  - A unique constraint covering the columns `[receiptNo]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "receiptNo" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_receiptNo_key" ON "Sale"("receiptNo");
