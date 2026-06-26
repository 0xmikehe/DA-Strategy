import { pathToFileURL } from "node:url";
import { prisma } from "./prisma";

export type DatabaseSmokeResult = {
  status: "ok";
  database: "postgresql";
  tables: {
    job_run: number;
    sync_cursor: number;
    decision_snapshot: number;
    ledger_ingest_batch: number;
    ledger_fact_observation: number;
    exchange_trade_fill: number;
    exchange_order: number;
    capital_flow_event: number;
    external_trade: number;
    attribution_record: number;
    ledger_reversal: number;
    account_balance_snapshot: number;
  };
};

export async function checkDatabaseConnection(): Promise<DatabaseSmokeResult> {
  const [
    jobRunCount,
    syncCursorCount,
    decisionSnapshotCount,
    ledgerIngestBatchCount,
    ledgerFactObservationCount,
    exchangeTradeFillCount,
    exchangeOrderCount,
    capitalFlowEventCount,
    externalTradeCount,
    attributionRecordCount,
    ledgerReversalCount,
    accountBalanceSnapshotCount
  ] = await Promise.all([
    prisma.jobRun.count(),
    prisma.syncCursor.count(),
    prisma.decisionSnapshot.count(),
    prisma.ledgerIngestBatch.count(),
    prisma.ledgerFactObservation.count(),
    prisma.exchangeTradeFill.count(),
    prisma.exchangeOrder.count(),
    prisma.capitalFlowEvent.count(),
    prisma.externalTrade.count(),
    prisma.attributionRecord.count(),
    prisma.ledgerReversal.count(),
    prisma.accountBalanceSnapshot.count()
  ]);

  return {
    status: "ok",
    database: "postgresql",
    tables: {
      job_run: jobRunCount,
      sync_cursor: syncCursorCount,
      decision_snapshot: decisionSnapshotCount,
      ledger_ingest_batch: ledgerIngestBatchCount,
      ledger_fact_observation: ledgerFactObservationCount,
      exchange_trade_fill: exchangeTradeFillCount,
      exchange_order: exchangeOrderCount,
      capital_flow_event: capitalFlowEventCount,
      external_trade: externalTradeCount,
      attribution_record: attributionRecordCount,
      ledger_reversal: ledgerReversalCount,
      account_balance_snapshot: accountBalanceSnapshotCount
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
