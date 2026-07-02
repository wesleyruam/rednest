-- CreateEnum
CREATE TYPE "NotePriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('open', 'doing', 'done');

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "engagement_id" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "priority" "NotePriority" NOT NULL DEFAULT 'medium',
    "status" "NoteStatus" NOT NULL DEFAULT 'open',
    "due_at" TIMESTAMP(3),
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notes_operation_id_idx" ON "notes"("operation_id");

-- CreateIndex
CREATE INDEX "notes_engagement_id_idx" ON "notes"("engagement_id");
