-- CreateEnum
CREATE TYPE "MonitorKind" AS ENUM ('http_content', 'ioc_recheck');

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT,
    "engagement_id" TEXT,
    "name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "stored_path" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT,
    "engagement_id" TEXT,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "stored_path" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitors" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "engagement_id" TEXT,
    "ioc_id" TEXT,
    "kind" "MonitorKind" NOT NULL,
    "target" TEXT NOT NULL,
    "interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_value" TEXT,
    "last_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_engagement_id_idx" ON "evidence"("engagement_id");

-- CreateIndex
CREATE INDEX "evidence_operation_id_idx" ON "evidence"("operation_id");

-- CreateIndex
CREATE INDEX "reports_operation_id_idx" ON "reports"("operation_id");

-- CreateIndex
CREATE INDEX "monitors_operation_id_idx" ON "monitors"("operation_id");

-- CreateIndex
CREATE INDEX "monitors_active_idx" ON "monitors"("active");
