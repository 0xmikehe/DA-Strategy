import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";
import { importLedgerPackage } from "@/ledger/package/import-package";
import { runLedgerReconciliationCli } from "@/ledger/reconciliation/cli";
import { prisma } from "@/server/db/prisma";

describe("ledger reconciliation CLI", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("runs local reconciliation against imported mock facts", async () => {
    const messages: string[] = [];
    await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }));

    await runLedgerReconciliationCli(
      ["--run-id", "recon_cli_mock", "--as-of", "2026-06-25T00:04:00.000Z", "--checked-at", "2026-06-25T00:04:00.000Z"],
      {
        stdout: (message) => messages.push(message)
      }
    );

    expect(JSON.parse(messages[0] ?? "{}")).toMatchObject({
      runId: "recon_cli_mock",
      written: 1
    });
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
