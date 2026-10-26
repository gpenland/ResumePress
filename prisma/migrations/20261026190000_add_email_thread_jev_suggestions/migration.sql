-- AlterTable
ALTER TABLE "EmailThread" ADD COLUMN     "jevClassifiedAt" TIMESTAMP(3),
ADD COLUMN     "jevRecruitingConfidence" DOUBLE PRECISION,
ADD COLUMN     "jevRecruitingLikely" BOOLEAN,
ADD COLUMN     "jevSuggestedApplicationConf" DOUBLE PRECISION,
ADD COLUMN     "jevSuggestedApplicationId" TEXT,
ADD COLUMN     "jevSuggestedContactConf" DOUBLE PRECISION,
ADD COLUMN     "jevSuggestedContactId" TEXT,
ADD COLUMN     "jevSuggestedNewCompany" TEXT,
ADD COLUMN     "jevSuggestedNewRole" TEXT,
ADD COLUMN     "jevSuggestedStatus" TEXT,
ADD COLUMN     "jevSuggestedStatusConf" DOUBLE PRECISION;

