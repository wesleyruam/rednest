-- CreateTable
CREATE TABLE "cves" (
    "id" TEXT NOT NULL,
    "cveId" TEXT NOT NULL,
    "published" TIMESTAMP(3),
    "lastModified" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "cvssScore" DOUBLE PRECISION,
    "cvssSeverity" TEXT,
    "cvssVector" TEXT,
    "cvssVersion" TEXT,
    "cwe" TEXT,
    "vendors" TEXT[],
    "products" TEXT[],
    "refs" TEXT[],
    "searchText" TEXT NOT NULL DEFAULT '',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cves_cveId_key" ON "cves"("cveId");

-- CreateIndex
CREATE INDEX "cves_cvssSeverity_idx" ON "cves"("cvssSeverity");

-- CreateIndex
CREATE INDEX "cves_published_idx" ON "cves"("published");
