-- CreateEnum
CREATE TYPE "StrategyVersionStatus" AS ENUM ('draft', 'active', 'superseded', 'retired');

-- CreateEnum
CREATE TYPE "AssetRole" AS ENUM ('stable', 'core', 'satellite', 'fee_asset');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('active', 'disabled', 'retired');

-- CreateEnum
CREATE TYPE "BindingState" AS ENUM ('active', 'warn', 'blocked');

-- CreateEnum
CREATE TYPE "PlannedActionStatus" AS ENUM ('draft', 'confirmed', 'dismissed', 'executed_manually');

-- CreateEnum
CREATE TYPE "ReviewDraftStatus" AS ENUM ('draft', 'confirmed', 'superseded');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('buy', 'sell');

-- CreateEnum
CREATE TYPE "CapitalFlowType" AS ENUM ('deposit', 'withdrawal', 'transfer_in', 'transfer_out');

-- CreateTable
CREATE TABLE "strategy_version" (
    "id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "StrategyVersionStatus" NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_pool_item" (
    "id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "role" "AssetRole" NOT NULL,
    "status" "AssetStatus" NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pool_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_action" (
    "action_id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "target_allocation_band_ref" TEXT NOT NULL,
    "reason_codes" JSONB NOT NULL,
    "status" "PlannedActionStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planned_action_pkey" PRIMARY KEY ("action_id")
);

-- CreateTable
CREATE TABLE "review_draft" (
    "review_id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "snapshot_refs" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "status" "ReviewDraftStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_draft_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "market_candle_fact" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "open_time" TIMESTAMP(3) NOT NULL,
    "close_time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(38,18) NOT NULL,
    "high" DECIMAL(38,18) NOT NULL,
    "low" DECIMAL(38,18) NOT NULL,
    "close" DECIMAL(38,18) NOT NULL,
    "volume" DECIMAL(38,18) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_candle_fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_rate_fact" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "funding_time" TIMESTAMP(3) NOT NULL,
    "funding_rate" DECIMAL(38,18) NOT NULL,
    "mark_price" DECIMAL(38,18),
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funding_rate_fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_account" (
    "id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "account_role" TEXT NOT NULL,
    "account_label" TEXT NOT NULL,
    "external_account_ref" TEXT,
    "key_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_account_binding" (
    "id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL,
    "exchange_account_id" TEXT NOT NULL,
    "binding_state" "BindingState" NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_account_binding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_event" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "exchange_account_id" TEXT NOT NULL,
    "strategy_id" TEXT,
    "strategy_version" TEXT,
    "snapshot_id" TEXT,
    "event_time" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "exchange_trade_fill" (
    "trade_id" TEXT NOT NULL,
    "ledger_event_id" TEXT NOT NULL,
    "exchange_account_id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "qty" DECIMAL(38,18) NOT NULL,
    "commission_asset" TEXT NOT NULL,
    "commission_qty" DECIMAL(38,18) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "external_trade_id" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_trade_fill_pkey" PRIMARY KEY ("trade_id")
);

-- CreateTable
CREATE TABLE "capital_flow_event" (
    "event_id" TEXT NOT NULL,
    "ledger_event_id" TEXT NOT NULL,
    "exchange_account_id" TEXT NOT NULL,
    "strategy_id" TEXT,
    "flow_type" "CapitalFlowType" NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL,
    "source_account" TEXT,
    "target_account" TEXT,
    "external_id" TEXT,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capital_flow_event_pkey" PRIMARY KEY ("event_id")
);

-- AddCheck
ALTER TABLE "decision_snapshot" ADD CONSTRAINT "decision_snapshot_sealed_content_json_check" CHECK ("immutability_state" <> 'sealed' OR "content_json" IS NOT NULL);

-- CreateIndex
CREATE INDEX "strategy_version_status_effective_from_idx" ON "strategy_version"("status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_version_strategy_id_version_key" ON "strategy_version"("strategy_id", "version");

-- CreateIndex
CREATE INDEX "asset_pool_item_strategy_id_strategy_version_idx" ON "asset_pool_item"("strategy_id", "strategy_version");

-- CreateIndex
CREATE UNIQUE INDEX "asset_pool_item_strategy_id_strategy_version_asset_key" ON "asset_pool_item"("strategy_id", "strategy_version", "asset");

-- CreateIndex
CREATE INDEX "planned_action_strategy_id_strategy_version_created_at_idx" ON "planned_action"("strategy_id", "strategy_version", "created_at");

-- CreateIndex
CREATE INDEX "planned_action_snapshot_id_idx" ON "planned_action"("snapshot_id");

-- CreateIndex
CREATE INDEX "planned_action_status_created_at_idx" ON "planned_action"("status", "created_at");

-- CreateIndex
CREATE INDEX "review_draft_strategy_id_strategy_version_period_start_idx" ON "review_draft"("strategy_id", "strategy_version", "period_start");

-- CreateIndex
CREATE INDEX "review_draft_status_created_at_idx" ON "review_draft"("status", "created_at");

-- CreateIndex
CREATE INDEX "market_candle_fact_symbol_interval_open_time_idx" ON "market_candle_fact"("symbol", "interval", "open_time");

-- CreateIndex
CREATE UNIQUE INDEX "market_candle_fact_source_symbol_interval_open_time_key" ON "market_candle_fact"("source", "symbol", "interval", "open_time");

-- CreateIndex
CREATE INDEX "funding_rate_fact_symbol_funding_time_idx" ON "funding_rate_fact"("symbol", "funding_time");

-- CreateIndex
CREATE UNIQUE INDEX "funding_rate_fact_source_symbol_funding_time_key" ON "funding_rate_fact"("source", "symbol", "funding_time");

-- CreateIndex
CREATE INDEX "exchange_account_exchange_account_role_idx" ON "exchange_account"("exchange", "account_role");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_account_exchange_external_account_ref_key" ON "exchange_account"("exchange", "external_account_ref");

-- CreateIndex
CREATE INDEX "strategy_account_binding_strategy_id_strategy_version_idx" ON "strategy_account_binding"("strategy_id", "strategy_version");

-- CreateIndex
CREATE INDEX "strategy_account_binding_exchange_account_id_idx" ON "strategy_account_binding"("exchange_account_id");

-- CreateIndex
CREATE INDEX "strategy_account_binding_binding_state_idx" ON "strategy_account_binding"("binding_state");

-- CreateIndex
CREATE INDEX "ledger_event_strategy_id_strategy_version_event_time_idx" ON "ledger_event"("strategy_id", "strategy_version", "event_time");

-- CreateIndex
CREATE INDEX "ledger_event_snapshot_id_idx" ON "ledger_event"("snapshot_id");

-- CreateIndex
CREATE INDEX "ledger_event_event_type_event_time_idx" ON "ledger_event"("event_type", "event_time");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_event_exchange_account_id_event_type_idempotency_key_key" ON "ledger_event"("exchange_account_id", "event_type", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_trade_fill_ledger_event_id_key" ON "exchange_trade_fill"("ledger_event_id");

-- CreateIndex
CREATE INDEX "exchange_trade_fill_strategy_id_strategy_version_time_idx" ON "exchange_trade_fill"("strategy_id", "strategy_version", "time");

-- CreateIndex
CREATE INDEX "exchange_trade_fill_snapshot_id_idx" ON "exchange_trade_fill"("snapshot_id");

-- CreateIndex
CREATE INDEX "exchange_trade_fill_ledger_event_id_idx" ON "exchange_trade_fill"("ledger_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_trade_fill_exchange_account_id_external_trade_id_key" ON "exchange_trade_fill"("exchange_account_id", "external_trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "capital_flow_event_ledger_event_id_key" ON "capital_flow_event"("ledger_event_id");

-- CreateIndex
CREATE INDEX "capital_flow_event_strategy_id_event_time_idx" ON "capital_flow_event"("strategy_id", "event_time");

-- CreateIndex
CREATE INDEX "capital_flow_event_exchange_account_id_event_time_idx" ON "capital_flow_event"("exchange_account_id", "event_time");

-- CreateIndex
CREATE INDEX "capital_flow_event_ledger_event_id_idx" ON "capital_flow_event"("ledger_event_id");

-- AddForeignKey
ALTER TABLE "asset_pool_item" ADD CONSTRAINT "asset_pool_item_strategy_id_strategy_version_fkey" FOREIGN KEY ("strategy_id", "strategy_version") REFERENCES "strategy_version"("strategy_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_action" ADD CONSTRAINT "planned_action_strategy_id_strategy_version_fkey" FOREIGN KEY ("strategy_id", "strategy_version") REFERENCES "strategy_version"("strategy_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_action" ADD CONSTRAINT "planned_action_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "decision_snapshot"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_draft" ADD CONSTRAINT "review_draft_strategy_id_strategy_version_fkey" FOREIGN KEY ("strategy_id", "strategy_version") REFERENCES "strategy_version"("strategy_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_account_binding" ADD CONSTRAINT "strategy_account_binding_strategy_id_strategy_version_fkey" FOREIGN KEY ("strategy_id", "strategy_version") REFERENCES "strategy_version"("strategy_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_account_binding" ADD CONSTRAINT "strategy_account_binding_exchange_account_id_fkey" FOREIGN KEY ("exchange_account_id") REFERENCES "exchange_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_event" ADD CONSTRAINT "ledger_event_exchange_account_id_fkey" FOREIGN KEY ("exchange_account_id") REFERENCES "exchange_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_event" ADD CONSTRAINT "ledger_event_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "decision_snapshot"("snapshot_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_trade_fill" ADD CONSTRAINT "exchange_trade_fill_ledger_event_id_fkey" FOREIGN KEY ("ledger_event_id") REFERENCES "ledger_event"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_trade_fill" ADD CONSTRAINT "exchange_trade_fill_exchange_account_id_fkey" FOREIGN KEY ("exchange_account_id") REFERENCES "exchange_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_trade_fill" ADD CONSTRAINT "exchange_trade_fill_strategy_id_strategy_version_fkey" FOREIGN KEY ("strategy_id", "strategy_version") REFERENCES "strategy_version"("strategy_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_trade_fill" ADD CONSTRAINT "exchange_trade_fill_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "decision_snapshot"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_flow_event" ADD CONSTRAINT "capital_flow_event_ledger_event_id_fkey" FOREIGN KEY ("ledger_event_id") REFERENCES "ledger_event"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_flow_event" ADD CONSTRAINT "capital_flow_event_exchange_account_id_fkey" FOREIGN KEY ("exchange_account_id") REFERENCES "exchange_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
