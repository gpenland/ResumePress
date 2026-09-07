-- Existing Entry/Resume rows were backfilled to their owning user out-of-band
-- before this migration runs; now enforce the NOT NULL constraint that
-- schema.prisma has always declared.
ALTER TABLE "Entry" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Resume" ALTER COLUMN "userId" SET NOT NULL;
