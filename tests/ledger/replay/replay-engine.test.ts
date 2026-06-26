import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";
import { importLedgerPackage } from "@/ledger/package/import-package";
import { readLedgerReplayInputs } from "@/ledger/replay/event-reader";
import { replayLedgerFacts } from "@/ledger/replay/replay-engine";
import { prisma } from "@/server/db/prisma";

describe("P2 replay engine over imported mock facts", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("replays deposit, buy fill, fee, and reported snapshot deterministically", async () => {
    await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }));

    const inputs = await readLedgerReplayInputs({
      prismaClient: prisma,
      asOf: "2026-06-25T00:04:00.000Z"
    });
    const replay = replayLedgerFacts(inputs.events, { asOf: "2026-06-25T00:04:00.000Z" });

    expect(inputs.events.map((event) => event.kind)).toEqual(["capital_flow", "trade_fill"]);
    expect(inputs.reportedSnapshots).toHaveLength(1);
    expect(replay.accountBalances).toMatchObject({
      acct_mock_core_spot: {
        USDT: "350.00000000",
        BTC: "0.00999000"
      }
    });
    expect(replay.strategyPositions).toMatchObject({
      core_allocation_lt: {
        BTC: "0.00999000",
        USDT: "-650.00000000"
      }
    });
    expect(replay.diagnostics).toEqual([]);
  });

  it("keeps replay output stable after duplicate import", async () => {
    const ledgerPackage = generateMockLedgerPackage({ scenarioId: "duplicate_import" });
    await importLedgerPackage(ledgerPackage);
    await importLedgerPackage(ledgerPackage);

    const inputs = await readLedgerReplayInputs({
      prismaClient: prisma,
      asOf: "2026-06-25T00:10:00.000Z"
    });
    const first = replayLedgerFacts(inputs.events, { asOf: "2026-06-25T00:10:00.000Z" });
    const second = replayLedgerFacts(inputs.events, { asOf: "2026-06-25T00:10:00.000Z" });

    expect(inputs.events).toHaveLength(1);
    expect(second).toEqual(first);
  });
});

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
