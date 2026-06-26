import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";
import { calculatePackageHash } from "@/ledger/package/hash";
import { importLedgerPackage } from "@/ledger/package/import-package";
import type { LedgerExportPackage, LedgerPackageKind } from "@/ledger/package/types";
import { prisma } from "@/server/db/prisma";

describe("ledger package import", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("imports mock packages with source_mode mock", async () => {
    const summary = await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }));

    expect(summary.source_mode).toBe("mock");
    expect(summary.result.inserted.exchange_trade_fill).toBe(1);

    const row = await prisma.exchangeTradeFill.findUnique({
      where: { naturalKey: "fill:acct_mock_core_spot:BTCUSDT:100" }
    });
    expect(row?.sourceMode).toBe("mock");
  });

  it("imports remote export packages with source_mode remote_import", async () => {
    const remotePackage = packageAs(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }), "remote_export");

    const summary = await importLedgerPackage(remotePackage);

    expect(summary.source_mode).toBe("remote_import");

    const row = await prisma.exchangeTradeFill.findUnique({
      where: { naturalKey: "fill:acct_mock_core_spot:BTCUSDT:100" }
    });
    expect(row?.sourceMode).toBe("remote_import");
  });

  it("imports cassette packages with source_mode cassette", async () => {
    const cassettePackage = packageAs(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }), "cassette");

    const summary = await importLedgerPackage(cassettePackage);

    expect(summary.source_mode).toBe("cassette");

    const row = await prisma.exchangeTradeFill.findUnique({
      where: { naturalKey: "fill:acct_mock_core_spot:BTCUSDT:100" }
    });
    expect(row?.sourceMode).toBe("cassette");
  });

  it("re-imports the same package idempotently", async () => {
    const ledgerPackage = generateMockLedgerPackage({ scenarioId: "duplicate_import" });

    await importLedgerPackage(ledgerPackage);
    await importLedgerPackage(ledgerPackage);

    await expect(prisma.exchangeTradeFill.count()).resolves.toBe(1);
    await expect(prisma.ledgerIngestBatch.count()).resolves.toBe(1);
  });

  it("rejects malformed hashes before writing an ingest batch", async () => {
    const ledgerPackage = generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" });
    const tampered = {
      ...ledgerPackage,
      exchange_trade_fills: [
        {
          ...ledgerPackage.exchange_trade_fills[0],
          payload: {
            ...ledgerPackage.exchange_trade_fills[0]?.payload,
            qty: "0.02000000"
          }
        }
      ]
    };

    await expect(importLedgerPackage(tampered)).rejects.toThrow("LEDGER_PACKAGE_HASH_MISMATCH");
    await expect(prisma.ledgerIngestBatch.count()).resolves.toBe(0);
  });

  it("preserves mixed fact-level origin metadata", async () => {
    await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "mixed_origin_package" }));

    const attribution = await prisma.attributionRecord.findUnique({
      where: { naturalKey: "attribution:manual:SOLUSDT:300" }
    });
    expect(attribution?.origin).toEqual({ kind: "manual_attribution" });
  });
});

function packageAs(ledgerPackage: LedgerExportPackage, packageKind: LedgerPackageKind): LedgerExportPackage {
  const packageWithoutHash: LedgerExportPackage = {
    ...ledgerPackage,
    manifest: {
      schema_version: "ledger.export.v1",
      package_id: `pkg_p2_1_${packageKind}`,
      package_kind: packageKind,
      export_run_id: `lexp_p2_1_${packageKind}`,
      source_env_id: packageKind === "remote_export" ? "remote-prod-1" : "cassette-fixture",
      sync_run_id: `job_p2_1_${packageKind}`,
      scenario_id: ledgerPackage.manifest.scenario_id,
      cassette_id: packageKind === "cassette" ? "cassette_p2_1_deposit_buy_fee" : undefined,
      produced_at: ledgerPackage.manifest.produced_at,
      content_hash: "",
      redaction_level: packageKind === "mock" ? "none" : "standard"
    }
  };

  return {
    ...packageWithoutHash,
    manifest: {
      ...packageWithoutHash.manifest,
      content_hash: calculatePackageHash(packageWithoutHash)
    }
  };
}

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
