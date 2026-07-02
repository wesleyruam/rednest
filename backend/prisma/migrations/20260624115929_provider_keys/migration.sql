-- CreateTable
CREATE TABLE "provider_keys" (
    "service" TEXT NOT NULL,
    "encrypted" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_keys_pkey" PRIMARY KEY ("service")
);
