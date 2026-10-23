-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "resumeSnapshotId" TEXT;

-- CreateTable
CREATE TABLE "EntryVersion" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeSnapshot" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "identity" JSONB,
    "entries" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeSnapshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EntryVersion" ADD CONSTRAINT "EntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryVersion" ADD CONSTRAINT "EntryVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeSnapshot" ADD CONSTRAINT "ResumeSnapshot_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeSnapshot" ADD CONSTRAINT "ResumeSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_resumeSnapshotId_fkey" FOREIGN KEY ("resumeSnapshotId") REFERENCES "ResumeSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
