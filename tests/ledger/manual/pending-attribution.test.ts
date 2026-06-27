import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { submitManualAttribution } from "@/ledger/manual/attribution-service";
import { submitManualExternalTrade } from "@/ledger/manual/external-trade-service";
import { getPendingAttributionItems } from "@/ledger/manual/pending-attribution";
import { submitManualReversal } from "@/ledger/manual/reversal-service";
import { prisma } from "@/server/db/prisma";

describe("pending attribution query", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("returns external trades without effective attribution", async () => {
    await seedExternalTrade("req_ext_pending");

    const items = await getPendingAttributionItems({ prismaClient: prisma });

    expect(items).toEqual([
      expect.objectContaining({
        factKind: "external_trade",
        idempotencyKey: "manual_external_trade:req_ext_pending",
        sourceMode: "live",
        accountId: "wallet_1",
        asset: "BTC",
        quantity: "0.01000000",
        attributionState: "pending",
        suggestedReason: "missing_attribution"
      })
    ]);
  });

  it("excludes strategy, external, unassigned, and reversed targets", async () => {
    await seedExternalTrade("req_ext_strategy");
    await seedExternalTrade("req_ext_external");
    await seedExternalTrade("req_ext_unassigned");
    await seedExternalTrade("req_ext_reversed");

    await submitManualAttribution(strategyAttribution("req_attr_strategy", "req_ext_strategy"), context());
    await submitManualAttribution(
      attribution("req_attr_external", "req_ext_external", "external", "operator_external_bucket"),
      context()
    );
    await submitManualAttribution(
      attribution("req_attr_unassigned", "req_ext_unassigned", "unassigned", "operator_unassigned_terminal"),
      context()
    );
    await submitManualReversal(
      {
        request_id: "req_rev_pending",
        target_fact_kind: "external_trade",
        target_idempotency_key: "manual_external_trade:req_ext_reversed",
        reason_code: "operator_correction",
        note: "duplicate external wallet entry",
        occurred_at: "2026-06-25T00:14:00.000Z"
      },
      context()
    );

    await expect(getPendingAttributionItems({ prismaClient: prisma })).resolves.toEqual([]);
  });

  it("is read-only", async () => {
    await seedExternalTrade("req_ext_readonly");
    const before = await tableCounts();

    await getPendingAttributionItems({ prismaClient: prisma });

    await expect(tableCounts()).resolves.toEqual(before);
  });

  it("treats reversed attribution records as ineffective", async () => {
    await seedExternalTrade("req_ext_reversed_attr");
    const attributionSummary = await submitManualAttribution(
      strategyAttribution("req_attr_to_reverse", "req_ext_reversed_attr"),
      context()
    );
    const attributionRow = await prisma.attributionRecord.findFirstOrThrow({
      where: { idempotencyKey: "manual_attribution:external_trade:manual_external_trade:req_ext_reversed_attr:req_attr_to_reverse" }
    });

    await submitManualReversal(
      {
        request_id: "req_rev_attr",
        target_fact_kind: "attribution_record",
        target_idempotency_key: attributionRow.idempotencyKey,
        reason_code: "operator_correction",
        note: "wrong strategy attribution",
        occurred_at: "2026-06-25T00:15:00.000Z"
      },
      context()
    );

    const items = await getPendingAttributionItems({ prismaClient: prisma });

    expect(attributionSummary.result.inserted.attribution_record).toBe(1);
    expect(items.map((item) => item.idempotencyKey)).toEqual(["manual_external_trade:req_ext_reversed_attr"]);
  });
});

async function seedExternalTrade(requestId: string) {
  await submitManualExternalTrade(
    {
      request_id: requestId,
      wallet_account_id: "wallet_1",
      side: "buy",
      base_asset: "BTC",
      quote_asset: "USDT",
      base_qty: "0.01000000",
      price: "65000.00",
      occurred_at: "2026-06-25T00:12:00.000Z"
    },
    context()
  );
}

function strategyAttribution(requestId: string, targetRequestId: string) {
  return {
    ...attribution(requestId, targetRequestId, "strategy" as const, "operator_classification"),
    strategy_id: "core_allocation_lt",
    strategy_version: "v1"
  };
}

function attribution(
  requestId: string,
  targetRequestId: string,
  assignmentKind: "strategy" | "external" | "unassigned",
  reasonCode: string
)
{
  return {
    request_id: requestId,
    target_fact_kind: "external_trade" as const,
    target_idempotency_key: `manual_external_trade:${targetRequestId}`,
    assignment_kind: assignmentKind,
    reason_code: reasonCode,
    occurred_at: "2026-06-25T00:13:00.000Z"
  };
}

function context() {
  return {
    prismaClient: prisma,
    actor: { kind: "user" as const, user_id: "operator_1" }
  };
}

async function tableCounts() {
  return {
    batches: await prisma.ledgerIngestBatch.count(),
    observations: await prisma.ledgerFactObservation.count(),
    externalTrades: await prisma.externalTrade.count(),
    attributionRecords: await prisma.attributionRecord.count(),
    reversals: await prisma.ledgerReversal.count()
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
