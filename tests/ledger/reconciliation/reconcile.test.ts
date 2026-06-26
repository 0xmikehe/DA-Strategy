import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  classifyReconciliation,
  reconciliationStatuses,
  runLedgerReconciliation,
  writeReconciliationResults
} from "@/ledger/reconciliation";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";
import { importLedgerPackage } from "@/ledger/package/import-package";
import type { ReconciliationInput } from "@/ledger/reconciliation";

describe("ledger reconciliation", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
    await prisma.reconciliationResult.deleteMany();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("defines the accepted reconciliation statuses exactly", () => {
    expect(reconciliationStatuses).toEqual([
      "MATCHED",
      "MISSING_EVENT",
      "EXTERNAL_BALANCE_MISMATCH",
      "NEEDS_CLASSIFICATION"
    ]);
  });

  it("classifies matched, missing-event, external-mismatch, and diagnostic cases", () => {
    expect(classifyReconciliation(input({ computedQty: "1.00000000", reportedQty: "1.00000000" })).status).toBe("MATCHED");
    expect(classifyReconciliation(input({ computedQty: "0.50000000", reportedQty: "1.00000000" })).status).toBe("MISSING_EVENT");
    expect(classifyReconciliation(input({ computedQty: "1.50000000", reportedQty: "1.00000000" })).status).toBe("EXTERNAL_BALANCE_MISMATCH");
    expect(
      classifyReconciliation(
        input({
          computedQty: "1.00000000",
          reportedQty: "1.00000000",
          diagnostics: [{ code: "UNSUPPORTED_EVENT", message: "needs operator classification" }]
        })
      ).status
    ).toBe("NEEDS_CLASSIFICATION");
  });

  it("represents missing reported snapshots explicitly", () => {
    const result = classifyReconciliation(input({ computedQty: "1.00000000", reportedQty: undefined, snapshotRef: undefined }));

    expect(result.status).toBe("NEEDS_CLASSIFICATION");
    expect(result.reportedQty).toBeUndefined();
    expect(result.snapshotRef).toBeUndefined();
    expect(result.note).toContain("missing reported snapshot");
  });

  it("stores append-only reconciliation results with decimal string quantities", async () => {
    const result = classifyReconciliation(input({ computedQty: "1.00000000", reportedQty: "1.00000000" }));

    await writeReconciliationResults({
      results: [result],
      prismaClient: prisma
    });
    await writeReconciliationResults({
      results: [{ ...result, checkedAt: "2026-06-25T00:06:00.000Z" }],
      prismaClient: prisma
    });

    const rows = await prisma.reconciliationResult.findMany({
      orderBy: { checkedAt: "asc" }
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      runId: "recon_run_001",
      accountId: "acct_mock_core_spot",
      asset: "BTC",
      computedQty: "1.00000000",
      reportedQty: "1.00000000",
      diffQty: "0.00000000",
      thresholdQty: "0.00000001",
      status: "MATCHED",
      snapshotRef: "snapshot:acct_mock_core_spot:BTC:2026-06-25T00:05:00.000Z:spot_total"
    });
  });

  it("runs reconciliation from imported mock facts and writes matched results", async () => {
    await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }));

    const summary = await runLedgerReconciliation({
      prismaClient: prisma,
      runId: "recon_mock_deposit_buy_fee",
      asOf: "2026-06-25T00:04:00.000Z",
      checkedAt: "2026-06-25T00:04:00.000Z"
    });

    expect(summary.written).toBe(1);
    const rows = await prisma.reconciliationResult.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      runId: "recon_mock_deposit_buy_fee",
      accountId: "acct_mock_core_spot",
      asset: "BTC",
      computedQty: "0.00999000",
      reportedQty: "0.00999000",
      status: "MATCHED"
    });
  });

  it("classifies reported-greater-than-computed mock snapshots as missing events", async () => {
    await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "missing_event_mismatch" }));

    await runLedgerReconciliation({
      prismaClient: prisma,
      runId: "recon_mock_missing_event",
      asOf: "2026-06-25T00:08:00.000Z",
      checkedAt: "2026-06-25T00:08:00.000Z"
    });

    const row = await prisma.reconciliationResult.findFirstOrThrow({
      where: { runId: "recon_mock_missing_event" }
    });

    expect(row).toMatchObject({
      accountId: "acct_mock_core_spot",
      asset: "USDT",
      computedQty: "0.00000000",
      reportedQty: "9999.00000000",
      status: "MISSING_EVENT"
    });
  });
});

function input(overrides: Partial<ReconciliationInput> = {}): ReconciliationInput {
  return {
    runId: "recon_run_001",
    accountId: "acct_mock_core_spot",
    asset: "BTC",
    computedQty: "1.00000000",
    reportedQty: "1.00000000",
    thresholdQty: "0.00000001",
    snapshotRef: "snapshot:acct_mock_core_spot:BTC:2026-06-25T00:05:00.000Z:spot_total",
    checkedAt: "2026-06-25T00:05:00.000Z",
    diagnostics: [],
    ...overrides
  };
}

async function cleanLedgerTables() {
  await prisma.reconciliationResult.deleteMany();
  await prisma.ledgerFactObservation.deleteMany();
  await prisma.ledgerIngestBatch.deleteMany();
  await prisma.ledgerReversal.deleteMany();
  await prisma.attributionRecord.deleteMany();
  await prisma.externalTrade.deleteMany();
  await prisma.capitalFlowEvent.deleteMany();
  await prisma.exchangeOrder.deleteMany();
  await prisma.exchangeTradeFill.deleteMany();
  await prisma.accountBalanceSnapshot.deleteMany();
  await prisma.syncCursor.deleteMany();
}
