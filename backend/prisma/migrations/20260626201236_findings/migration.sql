-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "engagement_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "source" TEXT,
    "target" TEXT,
    "severity" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "findings_engagement_id_type_idx" ON "findings"("engagement_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "findings_engagement_id_type_value_key" ON "findings"("engagement_id", "type", "value");

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
