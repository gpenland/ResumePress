-- AlterTable
ALTER TABLE "GmailAccount" ADD COLUMN     "needsReauth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reauthAt" TIMESTAMP(3);
