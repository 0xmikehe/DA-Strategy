import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { submitManualExternalTrade } from "@/ledger/manual/external-trade-service";
import { submitManualReversal } from "@/ledger/manual/reversal-service";
import { ManualReversalCommandSchema } from "@/ledger/manual/schemas";
import { prisma } from "@/server/db/prisma";

describe("manual reversal service", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("validates reversal target and reason", () => {
    expect(() =>
      ManualReversalCommandSchema.parse({
        request_id: "req_rev_bad",
        target_fact_kind: "external_trade",
        reason_code: "operator_correction",
        occurred_at: "2026-06-25T00:14:00.000Z"
      })
    ).toThrow();
  });

  it("appends reversal without editing or deleting the target fact", async () => {
    await seedExternalTrade();

    const summary = await submitManualReversal(
      {
        request_id: "req_rev_001",
        target_fact_kind: "external_trade",
        target_idempotency_key: "manual_external_trade:req_ext_reversal",
        reason_code: "operator_correction",
        note: "duplicate external wallet entry",
        occurred_at: "2026-06-25T00:14:00.000Z"
      },
      {
        prismaClient: prisma,
        actor: { kind: "user", user_id: "operator_1" }
      }
    );

    expect(summary.result.inserted.reversal).toBe(1);
    await expect(prisma.externalTrade.count()).resolves.toBe(1);
    await expect(prisma.ledgerReversal.count()).resolves.toBe(1);
  });

  it("rejects reversing a reversal in the initial implementation", async () => {
    await expect(
      submitManualReversal(
        {
          request_id: "req_rev_reversal",
          target_fact_kind: "reversal",
          target_idempotency_key: "manual_reversal:external_trade:some_target:req_rev_001",
          reason_code: "operator_correction",
          note: "not allowed",
          occurred_at: "2026-06-25T00:14:00.000Z"
        },
        {
          prismaClient: prisma,
          actor: { kind: "user", user_id: "operator_1" }
        }
      )
    ).rejects.toThrow("MANUAL_REVERSAL_OF_REVERSAL_UNSUPPORTED");
  });
});

async function seedExternalTrade() {
  await submitManualExternalTrade(
    {
      request_id: "req_ext_reversal",
      wallet_account_id: "wallet_1",
      side: "buy",
      base_asset: "BTC",
      quote_asset: "USDT",
      base_qty: "0.01000000",
      price: "65000.00",
      occurred_at: "2026-06-25T00:12:00.000Z"
    },
    {
      prismaClient: prisma,
      actor: { kind: "user", user_id: "operator_1" }
    }
  );
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
