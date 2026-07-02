-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'engine_started';
ALTER TYPE "EventType" ADD VALUE 'engine_finished';
ALTER TYPE "EventType" ADD VALUE 'engine_failed';
ALTER TYPE "EventType" ADD VALUE 'asset_found';
ALTER TYPE "EventType" ADD VALUE 'correlation';

-- AlterTable
ALTER TABLE "timeline_events" ADD COLUMN     "category" TEXT,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "engine" TEXT,
ADD COLUMN     "icon" TEXT;

-- CreateIndex
CREATE INDEX "timeline_events_engagement_id_idx" ON "timeline_events"("engagement_id");
