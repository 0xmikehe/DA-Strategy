-- CreateEnum
CREATE TYPE "MarketDerivedFactType" AS ENUM ('open_interest_hist', 'global_long_short_account_ratio', 'top_long_short_position_ratio', 'top_long_short_account_ratio');

-- CreateTable
CREATE TABLE "market_derived_fact" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fact_type" "MarketDerivedFactType" NOT NULL,
    "symbol" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sum_open_interest" DECIMAL(38,18),
    "sum_open_interest_value" DECIMAL(38,18),
    "cmc_circulating_supply" DECIMAL(38,18),
    "long_short_ratio" DECIMAL(38,18),
    "long_ratio" DECIMAL(38,18),
    "short_ratio" DECIMAL(38,18),
    "content_hash" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,

    CONSTRAINT "market_derived_fact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_derived_fact_symbol_period_fact_type_event_time_idx" ON "market_derived_fact"("symbol", "period", "fact_type", "event_time");

-- CreateIndex
CREATE INDEX "market_derived_fact_fact_type_collected_at_idx" ON "market_derived_fact"("fact_type", "collected_at");

-- CreateIndex
CREATE UNIQUE INDEX "market_derived_fact_source_fact_type_symbol_period_event_ti_key" ON "market_derived_fact"("source", "fact_type", "symbol", "period", "event_time");
