-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('ledger_sync', 'signal_fact_collect', 'signal_snapshot_build', 'strategy_review_draft');

-- CreateTable
CREATE TABLE "job_run" (
    "id" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "target_key" TEXT,
    "status" "JobRunStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_cursor" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "cursor_key" TEXT NOT NULL,
    "cursor_value" TEXT,
    "high_watermark" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_cursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_snapshot" (
    "snapshot_id" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "content_ref" TEXT,
    "content_json" JSONB,
    "immutability_state" TEXT NOT NULL DEFAULT 'sealed',

    CONSTRAINT "decision_snapshot_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateIndex
CREATE INDEX "job_run_job_type_status_created_at_idx" ON "job_run"("job_type", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_cursor_owner_cursor_key_key" ON "sync_cursor"("owner", "cursor_key");

-- CreateIndex
CREATE INDEX "decision_snapshot_created_at_idx" ON "decision_snapshot"("created_at");
