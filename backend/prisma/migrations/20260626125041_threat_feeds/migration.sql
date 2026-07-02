-- CreateTable
CREATE TABLE "threat_feed_items" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "iocType" TEXT,
    "indicator" TEXT,
    "vendor" TEXT,
    "product" TEXT,
    "severity" TEXT,
    "publishedAt" TIMESTAMP(3),
    "details" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "threat_feed_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "threat_feed_items_type_idx" ON "threat_feed_items"("type");

-- CreateIndex
CREATE INDEX "threat_feed_items_iocType_idx" ON "threat_feed_items"("iocType");

-- CreateIndex
CREATE INDEX "threat_feed_items_fetchedAt_idx" ON "threat_feed_items"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "threat_feed_items_source_key_key" ON "threat_feed_items"("source", "key");
