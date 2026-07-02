-- CreateEnum
CREATE TYPE "ProxyProtocol" AS ENUM ('http', 'socks4', 'socks5');

-- CreateTable
CREATE TABLE "proxies" (
    "id" TEXT NOT NULL,
    "protocol" "ProxyProtocol" NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "alive" BOOLEAN NOT NULL DEFAULT false,
    "latency_ms" INTEGER,
    "country" TEXT,
    "country_name" TEXT,
    "anonymity" TEXT,
    "exit_ip" TEXT,
    "source" TEXT NOT NULL DEFAULT 'proxyscrape',
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proxies_alive_latency_ms_idx" ON "proxies"("alive", "latency_ms");

-- CreateIndex
CREATE INDEX "proxies_protocol_idx" ON "proxies"("protocol");

-- CreateIndex
CREATE INDEX "proxies_country_idx" ON "proxies"("country");

-- CreateIndex
CREATE UNIQUE INDEX "proxies_protocol_host_port_key" ON "proxies"("protocol", "host", "port");
