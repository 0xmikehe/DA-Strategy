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
    capital_flow_event: number;
    planned_action: number;
    review_draft: number;
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
    capitalFlowEventCount,
    plannedActionCount,
    reviewDraftCount
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
    prisma.capitalFlowEvent.count(),
    prisma.plannedAction.count(),
    prisma.reviewDraft.count()
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
      capital_flow_event: capitalFlowEventCount,
      planned_action: plannedActionCount,
      review_draft: reviewDraftCount
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
