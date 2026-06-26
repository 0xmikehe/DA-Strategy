import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { promotePackageToCassette } from "@/ledger/cassette/promote";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";
import { verifyPackageHash } from "@/ledger/package/hash";
import { importLedgerPackage } from "@/ledger/package/import-package";
import { validateLedgerPackage } from "@/ledger/package/schema";
import { prisma } from "@/server/db/prisma";

const cassetteFixturePath = path.join(
  process.cwd(),
  "tests/fixtures/ledger/cassettes/cassette_p2_1_deposit_buy_fee.json"
);

describe("ledger cassette promotion", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("promotes a package into an immutable cassette identity", () => {
    const cassette = promotePackageToCassette(
      generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }),
      "cassette_p2_1_deposit_buy_fee"
    );

    expect(cassette.manifest.package_kind).toBe("cassette");
    expect(cassette.manifest.cassette_id).toBe("cassette_p2_1_deposit_buy_fee");
    expect(cassette.manifest.source_env_id).toBe("cassette-fixture");
    expect(verifyPackageHash(cassette)).toEqual(cassette);
    expect(() => promotePackageToCassette(cassette, "cassette_p2_1_other")).toThrow("LEDGER_CASSETTE_IMMUTABLE_ID");
  });

  it("imports promoted cassettes with source_mode cassette", async () => {
    const cassette = promotePackageToCassette(
      generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }),
      "cassette_p2_1_deposit_buy_fee"
    );

    const summary = await importLedgerPackage(cassette);

    expect(summary.source_mode).toBe("cassette");
    const row = await prisma.exchangeTradeFill.findUnique({
      where: { naturalKey: "fill:acct_mock_core_spot:BTCUSDT:100" }
    });
    expect(row?.sourceMode).toBe("cassette");
  });

  it("commits a safe cassette fixture for deposit_buy_fee", async () => {
    const rawFixture = await readFile(cassetteFixturePath, "utf8");
    const parsed = JSON.parse(rawFixture);

    expect(rawFixture).not.toMatch(/apiKey|apiSecret|signature|signedUrl|listenKey/i);
    expect(validateLedgerPackage(parsed).manifest.cassette_id).toBe("cassette_p2_1_deposit_buy_fee");
    expect(verifyPackageHash(parsed).manifest.package_kind).toBe("cassette");
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
