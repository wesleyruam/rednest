-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "engagement_id" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "photo" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "persons_operation_id_idx" ON "persons"("operation_id");

-- CreateIndex
CREATE INDEX "persons_engagement_id_idx" ON "persons"("engagement_id");
