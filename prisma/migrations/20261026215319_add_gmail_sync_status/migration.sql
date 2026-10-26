-- AlterTable
ALTER TABLE "GmailAccount" ADD COLUMN     "syncDone" INTEGER,
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncStartedAt" TIMESTAMP(3),
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN     "syncTotal" INTEGER;

