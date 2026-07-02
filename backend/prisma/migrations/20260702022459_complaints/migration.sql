-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('draft', 'submitted', 'acknowledged', 'in_review', 'resolved', 'rejected', 'closed');

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "engagement_id" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "target" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "ticket_id" TEXT,
    "ticket_url" TEXT,
    "category" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'submitted',
    "priority" "OperationPriority" NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complaints_operation_id_idx" ON "complaints"("operation_id");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");
