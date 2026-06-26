-- CreateEnum
CREATE TYPE "LedgerDataSourceMode" AS ENUM ('fixture', 'mock', 'cassette', 'remote_import', 'live');

-- CreateEnum
CREATE TYPE "LedgerFactKind" AS ENUM ('exchange_trade_fill', 'exchange_order', 'capital_flow_event', 'external_trade', 'attribution_record', 'reversal', 'account_balance_snapshot');

-- CreateEnum
CREATE TYPE "LedgerFactObservationStatus" AS ENUM ('inserted', 'duplicate');

-- CreateTable
CREATE TABLE "ledger_ingest_batch" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "source_mode" "LedgerDataSourceMode" NOT NULL,
    "default_origin" JSONB,
    "actor" JSONB NOT NULL,
    "trigger" JSONB NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "package_metadata" JSONB,
    "import_metadata" JSONB,
    "sync_metadata" JSONB,
    "canonical_hash" TEXT NOT NULL,
    "result_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_ingest_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_fact_observation" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "fact_kind" "LedgerFactKind" NOT NULL,
    "fact_table_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "status" "LedgerFactObservationStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_fact_observation_pkey" PRIMARY KEY ("id")
);

-- DropTable
DROP TABLE IF EXISTS "exchange_trade_fill";

-- DropTable
DROP TABLE IF EXISTS "capital_flow_event";

-- CreateTable
CREATE TABLE "exchange_trade_fill" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "source_mode" "LedgerDataSourceMode" NOT NULL,
    "origin" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source_event_time" TIMESTAMP(3),
    "exchange_account_id" TEXT,
    "asset" TEXT,
    "base_asset" TEXT,
    "quote_asset" TEXT,
    "symbol" TEXT,
    "external_id" TEXT,
    "strategy_id" TEXT,
    "strategy_version" TEXT,
    "snapshot_id" TEXT,
    "snapshot_time" TIMESTAMP(3),
    "reported_scope" TEXT,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_trade_fill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_order" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "source_mode" "LedgerDataSourceMode" NOT NULL,
    "origin" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source_event_time" TIMESTAMP(3),
    "exchange_account_id" TEXT,
    "asset" TEXT,
    "base_asset" TEXT,
    "quote_asset" TEXT,
    "symbol" TEXT,
    "external_id" TEXT,
    "strategy_id" TEXT,
    "strategy_version" TEXT,
    "snapshot_id" TEXT,
    "snapshot_time" TIMESTAMP(3),
    "reported_scope" TEXT,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_flow_event" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "source_mode" "LedgerDataSourceMode" NOT NULL,
    "origin" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source_event_time" TIMESTAMP(3),
    "exchange_account_id" TEXT,
    "asset" TEXT,
    "base_asset" TEXT,
    "quote_asset" TEXT,
    "symbol" TEXT,
    "external_id" TEXT,
    "strategy_id" TEXT,
    "strategy_version" TEXT,
    "snapshot_id" TEXT,
    "snapshot_time" TIMESTAMP(3),
    "reported_scope" TEXT,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capital_flow_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_trade" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "source_mode" "LedgerDataSourceMode" NOT NULL,
    "origin" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source_event_time" TIMESTAMP(3),
    "exchange_account_id" TEXT,
    "asset" TEXT,
    "base_asset" TEXT,
    "quote_asset" TEXT,
    "symbol" TEXT,
    "external_id" TEXT,
    "strategy_id" TEXT,
    "strategy_version" TEXT,
    "snapshot_id" TEXT,
    "snapshot_time" TIMESTAMP(3),
    "reported_scope" TEXT,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribution_record" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "source_mode" "LedgerDataSourceMode" NOT NULL,
    "origin" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source_event_time" TIMESTAMP(3),
    "exchange_account_id" TEXT,
    "asset" TEXT,
    "base_asset" TEXT,
    "quote_asset" TEXT,
    "symbol" TEXT,
    "external_id" TEXT,
    "strategy_id" TEXT,
    "strategy_version" TEXT,
    "snapshot_id" TEXT,
    "snapshot_time" TIMESTAMP(3),
    "reported_scope" TEXT,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribution_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_reversal" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "source_mode" "LedgerDataSourceMode" NOT NULL,
    "origin" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source_event_time" TIMESTAMP(3),
    "exchange_account_id" TEXT,
    "asset" TEXT,
    "base_asset" TEXT,
    "quote_asset" TEXT,
    "symbol" TEXT,
    "external_id" TEXT,
    "strategy_id" TEXT,
    "strategy_version" TEXT,
    "snapshot_id" TEXT,
    "snapshot_time" TIMESTAMP(3),
    "reported_scope" TEXT,
    "target_fact_kind" "LedgerFactKind" NOT NULL,
    "target_fact_idempotency_key" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_reversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balance_snapshot" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "source_mode" "LedgerDataSourceMode" NOT NULL,
    "origin" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source_event_time" TIMESTAMP(3),
    "exchange_account_id" TEXT,
    "asset" TEXT,
    "base_asset" TEXT,
    "quote_asset" TEXT,
    "symbol" TEXT,
    "external_id" TEXT,
    "strategy_id" TEXT,
    "strategy_version" TEXT,
    "snapshot_id" TEXT,
    "snapshot_time" TIMESTAMP(3),
    "reported_scope" TEXT,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_balance_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_ingest_batch_idempotency_key_key" ON "ledger_ingest_batch"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_ingest_batch_source_mode_requested_at_idx" ON "ledger_ingest_batch"("source_mode", "requested_at");

-- CreateIndex
CREATE INDEX "ledger_fact_observation_batch_id_idx" ON "ledger_fact_observation"("batch_id");

-- CreateIndex
CREATE INDEX "ledger_fact_observation_fact_kind_natural_key_idx" ON "ledger_fact_observation"("fact_kind", "natural_key");

-- CreateIndex
CREATE INDEX "ledger_fact_observation_idempotency_key_idx" ON "ledger_fact_observation"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_trade_fill_idempotency_key_key" ON "exchange_trade_fill"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_trade_fill_natural_key_key" ON "exchange_trade_fill"("natural_key");

-- CreateIndex
CREATE INDEX "exchange_trade_fill_source_mode_occurred_at_idx" ON "exchange_trade_fill"("source_mode", "occurred_at");

-- CreateIndex
CREATE INDEX "exchange_trade_fill_exchange_account_id_occurred_at_idx" ON "exchange_trade_fill"("exchange_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "exchange_trade_fill_asset_occurred_at_idx" ON "exchange_trade_fill"("asset", "occurred_at");

-- CreateIndex
CREATE INDEX "exchange_trade_fill_strategy_id_occurred_at_idx" ON "exchange_trade_fill"("strategy_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_order_idempotency_key_key" ON "exchange_order"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_order_natural_key_key" ON "exchange_order"("natural_key");

-- CreateIndex
CREATE INDEX "exchange_order_source_mode_occurred_at_idx" ON "exchange_order"("source_mode", "occurred_at");

-- CreateIndex
CREATE INDEX "exchange_order_exchange_account_id_occurred_at_idx" ON "exchange_order"("exchange_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "exchange_order_asset_occurred_at_idx" ON "exchange_order"("asset", "occurred_at");

-- CreateIndex
CREATE INDEX "exchange_order_strategy_id_occurred_at_idx" ON "exchange_order"("strategy_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "capital_flow_event_idempotency_key_key" ON "capital_flow_event"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "capital_flow_event_natural_key_key" ON "capital_flow_event"("natural_key");

-- CreateIndex
CREATE INDEX "capital_flow_event_source_mode_occurred_at_idx" ON "capital_flow_event"("source_mode", "occurred_at");

-- CreateIndex
CREATE INDEX "capital_flow_event_exchange_account_id_occurred_at_idx" ON "capital_flow_event"("exchange_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "capital_flow_event_asset_occurred_at_idx" ON "capital_flow_event"("asset", "occurred_at");

-- CreateIndex
CREATE INDEX "capital_flow_event_strategy_id_occurred_at_idx" ON "capital_flow_event"("strategy_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_trade_idempotency_key_key" ON "external_trade"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "external_trade_natural_key_key" ON "external_trade"("natural_key");

-- CreateIndex
CREATE INDEX "external_trade_source_mode_occurred_at_idx" ON "external_trade"("source_mode", "occurred_at");

-- CreateIndex
CREATE INDEX "external_trade_exchange_account_id_occurred_at_idx" ON "external_trade"("exchange_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "external_trade_asset_occurred_at_idx" ON "external_trade"("asset", "occurred_at");

-- CreateIndex
CREATE INDEX "external_trade_strategy_id_occurred_at_idx" ON "external_trade"("strategy_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "attribution_record_idempotency_key_key" ON "attribution_record"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "attribution_record_natural_key_key" ON "attribution_record"("natural_key");

-- CreateIndex
CREATE INDEX "attribution_record_source_mode_occurred_at_idx" ON "attribution_record"("source_mode", "occurred_at");

-- CreateIndex
CREATE INDEX "attribution_record_exchange_account_id_occurred_at_idx" ON "attribution_record"("exchange_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "attribution_record_asset_occurred_at_idx" ON "attribution_record"("asset", "occurred_at");

-- CreateIndex
CREATE INDEX "attribution_record_strategy_id_occurred_at_idx" ON "attribution_record"("strategy_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_reversal_idempotency_key_key" ON "ledger_reversal"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_reversal_natural_key_key" ON "ledger_reversal"("natural_key");

-- CreateIndex
CREATE INDEX "ledger_reversal_source_mode_occurred_at_idx" ON "ledger_reversal"("source_mode", "occurred_at");

-- CreateIndex
CREATE INDEX "ledger_reversal_exchange_account_id_occurred_at_idx" ON "ledger_reversal"("exchange_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "ledger_reversal_asset_occurred_at_idx" ON "ledger_reversal"("asset", "occurred_at");

-- CreateIndex
CREATE INDEX "ledger_reversal_strategy_id_occurred_at_idx" ON "ledger_reversal"("strategy_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_reversal_target_fact_kind_target_fact_idempotency_ke_key" ON "ledger_reversal"("target_fact_kind", "target_fact_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_snapshot_idempotency_key_key" ON "account_balance_snapshot"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_snapshot_natural_key_key" ON "account_balance_snapshot"("natural_key");

-- CreateIndex
CREATE INDEX "account_balance_snapshot_source_mode_occurred_at_idx" ON "account_balance_snapshot"("source_mode", "occurred_at");

-- CreateIndex
CREATE INDEX "account_balance_snapshot_exchange_account_id_occurred_at_idx" ON "account_balance_snapshot"("exchange_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "account_balance_snapshot_asset_occurred_at_idx" ON "account_balance_snapshot"("asset", "occurred_at");

-- CreateIndex
CREATE INDEX "account_balance_snapshot_exchange_account_id_asset_snapshot_idx" ON "account_balance_snapshot"("exchange_account_id", "asset", "snapshot_time", "reported_scope");

-- AddForeignKey
ALTER TABLE "ledger_fact_observation" ADD CONSTRAINT "ledger_fact_observation_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ledger_ingest_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
