import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { promotePackageToCassette } from "@/ledger/cassette/promote";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";
import { calculatePackageHash } from "@/ledger/package/hash";
import { importLedgerPackage } from "@/ledger/package/import-package";
import type { LedgerExportPackage, LedgerPackageKind } from "@/ledger/package/types";
import { runLedgerReconciliation } from "@/ledger/reconciliation/run";
import { getLedgerPageModel } from "@/ledger/page-model/get-ledger-page-model";
import { prisma } from "@/server/db/prisma";

describe("ledger page model", () => {
  beforeEach(async () => {
    await cleanLedgerTables();
  });

  afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  it("returns explicit empty states without fake balances", async () => {
    const model = await getLedgerPageModel({
      prismaClient: prisma,
      now: new Date("2026-06-27T00:00:00.000Z")
    });

    expect(model.freshness.state).toBe("empty");
    expect(model.sourceSummary.totalFacts).toBe(0);
    expect(model.reconciliation.rows).toEqual([]);
    expect(model.pendingAttribution.items).toEqual([]);
    expect(model.flows.rows).toEqual([]);
    expect("currentPositions" in model ? model.currentPositions : undefined).toEqual({
      eventCount: 0,
      accountRows: [],
      strategyRows: [],
      unassignedRows: [],
      diagnostics: []
    });
    expect(model.selectedScope).toEqual({
      kind: "all",
      scopeId: "all",
      label: "全部账户总览"
    });
    expect(model.portfolioSummary).toEqual(expect.objectContaining({
      estimatedValueUsd: undefined,
      accountCount: 0,
      walletCount: 0,
      assetCount: 0,
      pricedAssetCount: 0,
      unpricedAssetCount: 0,
      reconciliationIssueCount: 0,
      pendingAttributionCount: 0,
      assetRows: [],
      recentFlowRows: []
    }));
    expect(model.portfolioSummary.scopeOptions).toEqual([
      expect.objectContaining({
        kind: "all",
        scopeId: "all",
        label: "全部账户总览"
      })
    ]);
    expect(model.capabilities.externalTradeEntry).toBe(true);
  });

  it("preserves mock, cassette, remote_import, and live source modes for the page", async () => {
    await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "external_wallet_pending_attribution" }));
    await importLedgerPackage(
      promotePackageToCassette(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }), "cassette_p2_6_deposit_buy_fee")
    );
    await importLedgerPackage(packageAs(generateMockLedgerPackage({ scenarioId: "missing_event_mismatch" }), "remote_export"));
    await runLedgerReconciliation({
      prismaClient: prisma,
      runId: "recon_p2_6",
      checkedAt: "2026-06-25T00:20:00.000Z"
    });

    const model = await getLedgerPageModel({
      prismaClient: prisma,
      now: new Date("2026-06-27T00:00:00.000Z")
    });

    expect(model.sourceSummary.modes.map((row) => row.sourceMode).sort()).toEqual([
      "cassette",
      "mock",
      "remote_import"
    ]);
    expect(model.freshness.state).toBe("stale");
    expect(model.selectedScope).toEqual({
      kind: "all",
      scopeId: "all",
      label: "全部账户总览"
    });
    expect(model.currentPositions.accountRows).toEqual([]);
    expect(model.currentPositions.strategyRows).toEqual([]);
    expect(model.currentPositions.unassignedRows).toEqual([]);
    expect(model.reconciliation.rows).toEqual([]);
    expect(model.pendingAttribution.items).toEqual([]);
    expect(model.flows.rows).toEqual([]);
    expect(model.portfolioSummary).toEqual(expect.objectContaining({
      estimatedValueUsd: "2749.35",
      accountCount: 1,
      walletCount: 0,
      assetCount: 3,
      pricedAssetCount: 3,
      unpricedAssetCount: 0,
      reconciliationIssueCount: 1,
      pendingAttributionCount: 1,
      latestActivityAt: "2026-06-25T00:08:00.000Z"
    }));
    expect(model.portfolioSummary.assetRows).toEqual([
      expect.objectContaining({
        asset: "BTC",
        quantity: "0.00999000",
        valuationStatus: "priced",
        priceUsd: "65000.00",
        estimatedValueUsd: "649.35"
      }),
      expect.objectContaining({
        asset: "ETH",
        quantity: "0.50000000",
        valuationStatus: "priced",
        priceUsd: "3500.00",
        estimatedValueUsd: "1750.00"
      }),
      expect.objectContaining({
        asset: "USDT",
        quantity: "350.00000000",
        valuationStatus: "stablecoin_peg",
        priceUsd: "1.00",
        estimatedValueUsd: "350.00"
      })
    ]);
    expect(model.portfolioSummary.scopeOptions).toEqual([
      expect.objectContaining({
        kind: "all",
        scopeId: "all",
        estimatedValueUsd: "2749.35",
        reconciliationIssueCount: 1,
        pendingAttributionCount: 1
      }),
      expect.objectContaining({
        kind: "account",
        scopeId: "acct_mock_core_spot",
        label: "acct_mock_core_spot",
        accountId: "acct_mock_core_spot",
        role: "sub_account",
        assetCount: 3,
        pricedAssetCount: 3,
        unpricedAssetCount: 0,
        estimatedValueUsd: "2749.35",
        reconciliationIssueCount: 1,
        pendingAttributionCount: 1,
        latestActivityAt: "2026-06-25T00:08:00.000Z"
      })
    ]);
    expect(model.portfolioSummary.recentFlowRows.map((row) => row.sourceMode)).toEqual(expect.arrayContaining(["mock", "cassette", "remote_import"]));
    expect(JSON.stringify(model)).not.toMatch(/raw_payload|rawPayload|apiSecret|listenKey|signature/i);
  });

  it("filters the workbench details when a child account is selected", async () => {
    await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "external_wallet_pending_attribution" }));
    await importLedgerPackage(
      promotePackageToCassette(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }), "cassette_p2_6_deposit_buy_fee")
    );
    await importLedgerPackage(packageAs(generateMockLedgerPackage({ scenarioId: "missing_event_mismatch" }), "remote_export"));
    await runLedgerReconciliation({
      prismaClient: prisma,
      runId: "recon_p2_6_account",
      checkedAt: "2026-06-25T00:20:00.000Z"
    });

    const model = await getLedgerPageModel({
      prismaClient: prisma,
      now: new Date("2026-06-27T00:00:00.000Z"),
      selectedScopeId: "acct_mock_core_spot"
    });

    expect(model.selectedScope).toEqual({
      kind: "account",
      scopeId: "acct_mock_core_spot",
      label: "acct_mock_core_spot",
      accountId: "acct_mock_core_spot",
      role: "sub_account"
    });
    expect(model.currentPositions.accountRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scopeType: "account",
        scopeId: "acct_mock_core_spot",
        asset: "BTC",
        quantity: "0.00999000",
        reconciliationStatus: "MATCHED"
      }),
      expect.objectContaining({
        scopeType: "account",
        scopeId: "acct_mock_core_spot",
        asset: "USDT",
        quantity: "350.00000000",
        reconciliationStatus: "MISSING_EVENT"
      }),
      expect.objectContaining({
        scopeType: "account",
        scopeId: "acct_mock_core_spot",
        asset: "ETH",
        quantity: "0.50000000",
        estimatedValueUsd: "1750.00"
      })
    ]));
    expect(model.currentPositions.strategyRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scopeType: "strategy",
        scopeId: "core_allocation_lt",
        asset: "BTC",
        quantity: "0.00999000"
      })
    ]));
    expect(model.reconciliation.rows.every((row) => row.accountId === "acct_mock_core_spot")).toBe(true);
    expect(model.pendingAttribution.items).toEqual([
      expect.objectContaining({
        sourceMode: "mock",
        factKind: "external_trade",
        attributionState: "pending"
      })
    ]);
    expect(model.flows.rows.length).toBeGreaterThan(0);
    expect(model.flows.rows.every((row) => row.accountId === "acct_mock_core_spot")).toBe(true);
    expect(JSON.stringify(model)).not.toMatch(/raw_payload|rawPayload|apiSecret|listenKey|signature/i);
  });
});

function packageAs(ledgerPackage: LedgerExportPackage, packageKind: LedgerPackageKind): LedgerExportPackage {
  const packageWithoutHash: LedgerExportPackage = {
    ...ledgerPackage,
    manifest: {
      schema_version: "ledger.export.v1",
      package_id: `pkg_p2_6_${packageKind}_${ledgerPackage.manifest.scenario_id}`,
      package_kind: packageKind,
      export_run_id: `lexp_p2_6_${packageKind}_${ledgerPackage.manifest.scenario_id}`,
      source_env_id: packageKind === "remote_export" ? "remote-prod-1" : "cassette-fixture",
      sync_run_id: `job_p2_6_${packageKind}_${ledgerPackage.manifest.scenario_id}`,
      scenario_id: ledgerPackage.manifest.scenario_id,
      cassette_id: packageKind === "cassette" ? `cassette_p2_6_${ledgerPackage.manifest.scenario_id}` : undefined,
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
