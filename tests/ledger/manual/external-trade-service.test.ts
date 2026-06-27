import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { submitManualExternalTrade } from "@/ledger/manual/external-trade-service";
import { ManualExternalTradeCommandSchema } from "@/ledger/manual/schemas";
import { prisma } from "@/server/db/prisma";

describe("manual external trade service", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("validates the public command shape and rejects future timestamps", () => {
    expect(() =>
      ManualExternalTradeCommandSchema.parse({
        request_id: "req_ext_001",
        wallet_account_id: "wallet_1",
        side: "buy",
        base_asset: "BTC",
        quote_asset: "USDT",
        base_qty: "0.01000000",
        price: "65000.00",
        occurred_at: "2999-01-01T00:00:00.000Z"
      })
    ).toThrow();

    expect(() =>
      ManualExternalTradeCommandSchema.parse({
        ...validExternalTrade(),
        manual_balance_adjustment: "100.00"
      })
    ).toThrow();
  });

  it("writes external_trade through appendLedgerFacts with manual live metadata", async () => {
    const trigger = vi.fn().mockResolvedValue({ ok: true });

    const summary = await submitManualExternalTrade(validExternalTrade(), {
      prismaClient: prisma,
      actor: { kind: "user", user_id: "operator_1" },
      afterIngest: trigger
    });

    expect(summary.result.inserted.external_trade).toBe(1);
    expect(trigger).toHaveBeenCalledTimes(1);

    const row = await prisma.externalTrade.findUniqueOrThrow({
      where: { idempotencyKey: "manual_external_trade:req_ext_001" }
    });
    expect(row.sourceMode).toBe("live");
    expect(row.origin).toEqual({ kind: "manual_external_trade" });
    await expect(prisma.ledgerIngestBatch.findFirstOrThrow()).resolves.toMatchObject({
      trigger: { kind: "manual_entry", request_id: "req_ext_001" }
    });
  });

  it("adds optional strategy attribution in the same batch", async () => {
    const summary = await submitManualExternalTrade(
      {
        ...validExternalTrade(),
        request_id: "req_ext_with_attr",
        strategy_id: "core_allocation_lt",
        strategy_version: "v1"
      },
      {
        prismaClient: prisma,
        actor: { kind: "user", user_id: "operator_1" }
      }
    );

    expect(summary.result.inserted.external_trade).toBe(1);
    expect(summary.result.inserted.attribution_record).toBe(1);
    await expect(prisma.externalTrade.count()).resolves.toBe(1);
    await expect(prisma.attributionRecord.count()).resolves.toBe(1);
  });
});

function validExternalTrade() {
  return {
    request_id: "req_ext_001",
    wallet_account_id: "wallet_1",
    side: "buy" as const,
    base_asset: "BTC",
    quote_asset: "USDT",
    base_qty: "0.01000000",
    price: "65000.00",
    occurred_at: "2026-06-25T00:12:00.000Z",
    venue: "external_wallet"
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
