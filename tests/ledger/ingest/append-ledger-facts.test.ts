import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { appendLedgerFacts, LedgerIngestConflictError } from "@/ledger/ingest";
import { prisma } from "@/server/db/prisma";
import {
  balanceSnapshotCommand,
  fixtureTradeCommand,
  liveEmptyCursorCommand,
  liveTradeCommand,
  remoteImportCommand,
  reversalCommand
} from "./builders";

describe("appendLedgerFacts", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("inserts a fixture trade through the single ingest boundary with typed dimensions", async () => {
    const result = await appendLedgerFacts(fixtureTradeCommand());

    expect(result.inserted.exchange_trade_fill).toBe(1);
    expect(result.skipped_duplicate.exchange_trade_fill).toBe(0);

    const row = await prisma.exchangeTradeFill.findUnique({
      where: { naturalKey: "acct_1:BTCUSDT:100" }
    });
    expect(row).toMatchObject({
      exchangeAccountId: "acct_1",
      strategyId: "core_allocation_lt",
      strategyVersion: "v1",
      snapshotId: "snap_001",
      asset: "BTC",
      symbol: "BTCUSDT"
    });
    await expect(prisma.ledgerIngestBatch.count()).resolves.toBe(1);
  });

  it("repeating the same batch returns stored summary without new observations", async () => {
    await appendLedgerFacts(fixtureTradeCommand());
    const result = await appendLedgerFacts(fixtureTradeCommand());

    expect(result.inserted.exchange_trade_fill).toBe(1);
    expect(result.skipped_duplicate.exchange_trade_fill).toBe(0);
    await expect(prisma.exchangeTradeFill.count()).resolves.toBe(1);
    await expect(prisma.ledgerFactObservation.count()).resolves.toBe(1);
  });

  it("rejects same batch idempotency key with different canonical content", async () => {
    await appendLedgerFacts(fixtureTradeCommand());

    await expect(
      appendLedgerFacts(
        fixtureTradeCommand({
          facts: [
            {
              ...fixtureTradeCommand().facts[0],
              payload: {
                ...fixtureTradeCommand().facts[0]?.payload,
                qty: "0.02000000"
              }
            }
          ]
        })
      )
    ).rejects.toBeInstanceOf(LedgerIngestConflictError);
  });

  it("does not duplicate the same natural fact across remote import and live modes", async () => {
    await appendLedgerFacts(remoteImportCommand());
    const result = await appendLedgerFacts(liveTradeCommand());

    expect(result.inserted.exchange_trade_fill).toBe(0);
    expect(result.skipped_duplicate.exchange_trade_fill).toBe(1);
    await expect(prisma.exchangeTradeFill.count()).resolves.toBe(1);
  });

  it("rejects same idempotency key with a different natural key", async () => {
    await appendLedgerFacts(fixtureTradeCommand());

    await expect(
      appendLedgerFacts(
        fixtureTradeCommand({
          batch: {
            ...fixtureTradeCommand().batch,
            idempotency_key: "batch_conflicting_fact_idempotency_key"
          },
          facts: [
            {
              ...fixtureTradeCommand().facts[0],
              natural_key: "acct_1:BTCUSDT:101"
            }
          ]
        })
      )
    ).rejects.toBeInstanceOf(LedgerIngestConflictError);
  });

  it("commits cursor advancement for an empty successful live window", async () => {
    const result = await appendLedgerFacts(liveEmptyCursorCommand());

    expect(result.cursor_advancements).toBe(1);
    const cursor = await prisma.syncCursor.findUnique({
      where: {
        owner_cursorKey: {
          owner: "ledger:acct_1:spot_my_trades",
          cursorKey: "BTCUSDT"
        }
      }
    });
    expect(cursor?.cursorValue).toBe("100");
  });

  it("repeating an old cursor batch returns stored summary without moving the cursor backward", async () => {
    await appendLedgerFacts(liveEmptyCursorCommand());
    await appendLedgerFacts({
      ...liveEmptyCursorCommand(),
      batch: {
        ...liveEmptyCursorCommand().batch,
        idempotency_key: "batch_live_empty_cursor_002"
      },
      cursor_advancements: [
        {
          owner: "ledger:acct_1:spot_my_trades",
          cursor_key: "BTCUSDT",
          previous_cursor_value: "100",
          next_cursor_value: "200"
        }
      ]
    });

    const replayResult = await appendLedgerFacts(liveEmptyCursorCommand());
    const cursor = await prisma.syncCursor.findUnique({
      where: {
        owner_cursorKey: {
          owner: "ledger:acct_1:spot_my_trades",
          cursorKey: "BTCUSDT"
        }
      }
    });

    expect(replayResult.cursor_advancements).toBe(1);
    expect(cursor?.cursorValue).toBe("200");
  });

  it("does not advance cursor when a fact conflict aborts the batch", async () => {
    await appendLedgerFacts(fixtureTradeCommand());

    await expect(
      appendLedgerFacts(
        fixtureTradeCommand({
          batch: {
            ...fixtureTradeCommand().batch,
            idempotency_key: "batch_conflict_with_cursor"
          },
          facts: [
            {
              ...fixtureTradeCommand().facts[0],
              payload: {
                ...fixtureTradeCommand().facts[0]?.payload,
                qty: "0.02000000"
              }
            }
          ],
          cursor_advancements: [
            {
              owner: "ledger:acct_1:spot_my_trades",
              cursor_key: "BTCUSDT",
              next_cursor_value: "101"
            }
          ]
        })
      )
    ).rejects.toBeInstanceOf(LedgerIngestConflictError);

    await expect(prisma.syncCursor.count()).resolves.toBe(0);
  });

  it("stores account balance snapshot reported_scope as a typed dimension", async () => {
    await appendLedgerFacts(balanceSnapshotCommand());

    const snapshot = await prisma.accountBalanceSnapshot.findUnique({
      where: { naturalKey: "acct_1:BTC:2026-06-25T00:00:00.000Z:spot_total" }
    });
    expect(snapshot).toMatchObject({
      exchangeAccountId: "acct_1",
      asset: "BTC",
      reportedScope: "spot_total"
    });
  });

  it("appends a reversal without editing the target fact", async () => {
    await appendLedgerFacts(fixtureTradeCommand());
    const result = await appendLedgerFacts(reversalCommand("exchange_trade_fill", "trade_acct_1_btcusdt_100"));

    expect(result.inserted.reversal).toBe(1);
    await expect(prisma.exchangeTradeFill.count()).resolves.toBe(1);
    await expect(prisma.ledgerReversal.count()).resolves.toBe(1);
  });

  it("repeating the same reversal batch is idempotent", async () => {
    await appendLedgerFacts(fixtureTradeCommand());
    const command = reversalCommand("exchange_trade_fill", "trade_acct_1_btcusdt_100");
    await appendLedgerFacts(command);
    const result = await appendLedgerFacts(command);

    expect(result.inserted.reversal).toBe(1);
    await expect(prisma.ledgerReversal.count()).resolves.toBe(1);
  });
});

async function cleanLedgerTables() {
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
