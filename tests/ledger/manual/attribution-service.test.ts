import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { submitManualExternalTrade } from "@/ledger/manual/external-trade-service";
import { submitManualAttribution } from "@/ledger/manual/attribution-service";
import { ManualAttributionCommandSchema } from "@/ledger/manual/schemas";
import { prisma } from "@/server/db/prisma";

describe("manual attribution service", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("validates target and assignment command shape", () => {
    expect(() =>
      ManualAttributionCommandSchema.parse({
        request_id: "req_attr_bad",
        target_fact_kind: "external_trade",
        assignment_kind: "strategy",
        reason_code: "operator_classification",
        occurred_at: "2026-06-25T00:13:00.000Z"
      })
    ).toThrow();
  });

  it("appends attribution records and does not change account balances", async () => {
    await seedExternalTrade("req_ext_pending");

    const summary = await submitManualAttribution(
      {
        request_id: "req_attr_001",
        target_fact_kind: "external_trade",
        target_idempotency_key: "manual_external_trade:req_ext_pending",
        assignment_kind: "strategy",
        strategy_id: "core_allocation_lt",
        strategy_version: "v1",
        reason_code: "operator_classification",
        occurred_at: "2026-06-25T00:13:00.000Z"
      },
      {
        prismaClient: prisma,
        actor: { kind: "user", user_id: "operator_1" }
      }
    );

    expect(summary.result.inserted.attribution_record).toBe(1);
    await expect(prisma.externalTrade.count()).resolves.toBe(1);
    await expect(prisma.attributionRecord.count()).resolves.toBe(1);
  });

  it("keeps re-attribution append-only", async () => {
    await seedExternalTrade("req_ext_reattr");

    await submitManualAttribution(strategyAttribution("req_attr_strategy"), context());
    await submitManualAttribution(
      {
        ...strategyAttribution("req_attr_unassigned"),
        assignment_kind: "unassigned",
        strategy_id: undefined,
        strategy_version: undefined,
        reason_code: "operator_unassigned_terminal"
      },
      context()
    );

    await expect(prisma.attributionRecord.count()).resolves.toBe(2);
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

function strategyAttribution(requestId: string) {
  return {
    request_id: requestId,
    target_fact_kind: "external_trade" as const,
    target_idempotency_key: "manual_external_trade:req_ext_reattr",
    assignment_kind: "strategy" as const,
    strategy_id: "core_allocation_lt",
    strategy_version: "v1",
    reason_code: "operator_classification",
    occurred_at: "2026-06-25T00:13:00.000Z"
  };
}

function context() {
  return {
    prismaClient: prisma,
    actor: { kind: "user" as const, user_id: "operator_1" }
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
