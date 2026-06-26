import { pathToFileURL } from "node:url";
import { prisma } from "./prisma";

export type DatabaseSmokeResult = {
  status: "ok";
  database: "postgresql";
  tables: {
    job_run: number;
    sync_cursor: number;
    decision_snapshot: number;
    strategy_version: number;
    asset_pool_item: number;
    market_candle_fact: number;
    funding_rate_fact: number;
    market_derived_fact: number;
    exchange_account: number;
    strategy_account_binding: number;
    ledger_event: number;
    exchange_trade_fill: number;
    exchange_order: number;
    capital_flow_event: number;
    external_trade: number;
    attribution_record: number;
    ledger_reversal: number;
    account_balance_snapshot: number;
    planned_action: number;
    review_draft: number;
    ledger_ingest_batch: number;
    ledger_fact_observation: number;
  };
};

export async function checkDatabaseConnection(): Promise<DatabaseSmokeResult> {
  const [
    jobRunCount,
    syncCursorCount,
    decisionSnapshotCount,
    strategyVersionCount,
    assetPoolItemCount,
    marketCandleFactCount,
    fundingRateFactCount,
    marketDerivedFactCount,
    exchangeAccountCount,
    strategyAccountBindingCount,
    ledgerEventCount,
    exchangeTradeFillCount,
    exchangeOrderCount,
    capitalFlowEventCount,
    externalTradeCount,
    attributionRecordCount,
    ledgerReversalCount,
    accountBalanceSnapshotCount,
    plannedActionCount,
    reviewDraftCount,
    ledgerIngestBatchCount,
    ledgerFactObservationCount
  ] = await Promise.all([
    prisma.jobRun.count(),
    prisma.syncCursor.count(),
    prisma.decisionSnapshot.count(),
    prisma.strategyVersion.count(),
    prisma.assetPoolItem.count(),
    prisma.marketCandleFact.count(),
    prisma.fundingRateFact.count(),
    prisma.marketDerivedFact.count(),
    prisma.exchangeAccount.count(),
    prisma.strategyAccountBinding.count(),
    prisma.ledgerEvent.count(),
    prisma.exchangeTradeFill.count(),
    prisma.exchangeOrder.count(),
    prisma.capitalFlowEvent.count(),
    prisma.externalTrade.count(),
    prisma.attributionRecord.count(),
    prisma.ledgerReversal.count(),
    prisma.accountBalanceSnapshot.count(),
    prisma.plannedAction.count(),
    prisma.reviewDraft.count(),
    prisma.ledgerIngestBatch.count(),
    prisma.ledgerFactObservation.count()
  ]);

  return {
    status: "ok",
    database: "postgresql",
    tables: {
      job_run: jobRunCount,
      sync_cursor: syncCursorCount,
      decision_snapshot: decisionSnapshotCount,
      strategy_version: strategyVersionCount,
      asset_pool_item: assetPoolItemCount,
      market_candle_fact: marketCandleFactCount,
      funding_rate_fact: fundingRateFactCount,
      market_derived_fact: marketDerivedFactCount,
      exchange_account: exchangeAccountCount,
      strategy_account_binding: strategyAccountBindingCount,
      ledger_event: ledgerEventCount,
      exchange_trade_fill: exchangeTradeFillCount,
      exchange_order: exchangeOrderCount,
      capital_flow_event: capitalFlowEventCount,
      external_trade: externalTradeCount,
      attribution_record: attributionRecordCount,
      ledger_reversal: ledgerReversalCount,
      account_balance_snapshot: accountBalanceSnapshotCount,
      planned_action: plannedActionCount,
      review_draft: reviewDraftCount,
      ledger_ingest_batch: ledgerIngestBatchCount,
      ledger_fact_observation: ledgerFactObservationCount
    }
  };
}

async function main() {
  try {
    console.log(JSON.stringify(await checkDatabaseConnection()));
  } finally {
    await prisma.$disconnect();
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
