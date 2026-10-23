-- AlterTable: drop fields removed per GitHub issue #17, change default status
ALTER TABLE "Application" DROP COLUMN "deadline",
                           DROP COLUMN "priority",
                           DROP COLUMN "nextFollowUpAt",
                           ALTER COLUMN "status" SET DEFAULT 'Applied';

-- AlterTable: add a freeform note to status history entries, so updates can
-- be logged (or annotated after the fact) without inventing custom statuses
ALTER TABLE "ApplicationStatusHistory" ADD COLUMN "note" TEXT;
