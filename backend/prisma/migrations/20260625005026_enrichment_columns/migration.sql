-- AlterTable
ALTER TABLE "engagements" ADD COLUMN     "enrichment" JSONB;

-- AlterTable
ALTER TABLE "iocs" ADD COLUMN     "enrichment" JSONB;
