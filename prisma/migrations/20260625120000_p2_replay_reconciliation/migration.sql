CREATE TYPE "ReconciliationResultStatus" AS ENUM ('MATCHED', 'MISSING_EVENT', 'EXTERNAL_BALANCE_MISMATCH', 'NEEDS_CLASSIFICATION');

CREATE TABLE "reconciliation_result" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "computed_qty" TEXT NOT NULL,
    "reported_qty" TEXT,
    "diff_qty" TEXT NOT NULL,
    "threshold_qty" TEXT NOT NULL,
    "status" "ReconciliationResultStatus" NOT NULL,
    "snapshot_ref" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "diagnostics_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_result_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reconciliation_result_run_id_idx" ON "reconciliation_result"("run_id");
CREATE INDEX "reconciliation_result_account_id_asset_checked_at_idx" ON "reconciliation_result"("account_id", "asset", "checked_at");
CREATE INDEX "reconciliation_result_status_checked_at_idx" ON "reconciliation_result"("status", "checked_at");
