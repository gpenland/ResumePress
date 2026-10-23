-- AlterTable: Gmail labels the user selected to sync (Phase 2C)
ALTER TABLE "GmailAccount" ADD COLUMN "syncLabelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
