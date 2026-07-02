-- AlterTable
ALTER TABLE "monitors" ADD COLUMN     "last_content" TEXT;

-- CreateTable
CREATE TABLE "monitor_runs" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "http_status" INTEGER,
    "content_hash" TEXT,
    "content_length" INTEGER,
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "diff" JSONB,
    "screenshot" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitor_runs_monitor_id_created_at_idx" ON "monitor_runs"("monitor_id", "created_at");

-- AddForeignKey
ALTER TABLE "monitor_runs" ADD CONSTRAINT "monitor_runs_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
