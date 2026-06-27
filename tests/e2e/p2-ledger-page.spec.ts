import { expect, test } from "@playwright/test";
import { promotePackageToCassette } from "@/ledger/cassette/promote";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";
import { calculatePackageHash } from "@/ledger/package/hash";
import { importLedgerPackage } from "@/ledger/package/import-package";
import type { LedgerExportPackage, LedgerPackageKind } from "@/ledger/package/types";
import { runLedgerReconciliation } from "@/ledger/reconciliation/run";
import { prisma } from "@/server/db/prisma";

test.describe.configure({ mode: "serial" });

test.describe("P2 ledger page loop", () => {
  test.beforeAll(async () => {
    await seedLedgerPageLoop();
  });

  test.afterAll(async () => {
    await cleanLedgerTables();
    await prisma.$disconnect();
  });

  test("opens from the workspace entry and renders mock, cassette, and remote_import state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "账本页" }).first().click();

    await expect(page).toHaveURL(/\/ledger$/);
    await expect(page.getByRole("heading", { level: 1, name: "账本工作台" })).toBeVisible();
    await expect(page.getByText("数据陈旧 stale").first()).toBeVisible();
    await expect(page.getByText("mock").first()).toBeVisible();
    await expect(page.getByText("cassette").first()).toBeVisible();
    await expect(page.getByText("remote_import").first()).toBeVisible();
    await expect(page.getByText("全部账户总览").first()).toBeVisible();
    await expect(page.getByText("tracked value")).toBeVisible();
    await expect(page.getByText("2749.35").first()).toBeVisible();
    await expect(page.getByText("账户 / 钱包入口")).toBeVisible();
    await expect(page.getByRole("link", { name: /acct_mock_core_spot/ }).first()).toBeVisible();
    await expect(page.getByText("3 assets").first()).toBeVisible();
    await expect(page.getByText("当前持仓", { exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "提交外部交易" })).not.toBeVisible();

    await page.getByRole("link", { name: /acct_mock_core_spot/ }).first().click();

    await expect(page).toHaveURL(/\/ledger\?account=acct_mock_core_spot$/);
    await expect(page.getByText("当前持仓", { exact: true })).toBeVisible();
    await expect(page.getByText("账户余额", { exact: true })).toBeVisible();
    await expect(page.getByText("策略归属持仓", { exact: true })).toBeVisible();
    await expect(page.getByText("0.00999000 BTC").first()).toBeVisible();
    await expect(page.getByText("350.00000000 USDT").first()).toBeVisible();
    await expect(page.getByText("疑似漏事件").first()).toBeVisible();
    await expect(page.getByText("-9649.00000000").first()).toBeVisible();
    await expect(page.getByText("external_wallet_eth_001").first()).toBeVisible();
    await expect(page.getByText("0.50000000 ETH").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "归属策略" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "冲正" }).first()).toBeVisible();
    await expect(page.getByText("异常处理", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "提交外部交易" })).not.toBeVisible();

    const body = page.locator("body");
    await expect(body).not.toContainText("key_ref");
    await expect(body).not.toContainText("raw_payload");
    await expect(body).not.toContainText("manual balance adjustment");
  });

  test("keeps critical ledger state visible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ledger");

    await expect(page.getByRole("heading", { level: 1, name: "账本工作台" })).toBeVisible();
    await expect(page.getByText("同步与新鲜度")).toBeVisible();
    await expect(page.getByText("全部账户总览").first()).toBeVisible();
    await expect(page.getByText("账户 / 钱包入口")).toBeVisible();
    await expect(page.getByText("tracked value")).toBeVisible();
    await expect(page.getByText("当前持仓", { exact: true })).not.toBeVisible();

    await page.goto("/ledger?account=acct_mock_core_spot");

    await expect(page.getByText("当前持仓", { exact: true })).toBeVisible();
    await expect(page.getByText("对账面板")).toBeVisible();
    await expect(page.getByText("待归属交易队列")).toBeVisible();
    await expect(page.getByText("异常处理", { exact: true })).toBeVisible();
    await expect(page.getByText("remote_import").first()).toBeVisible();
  });
});

async function seedLedgerPageLoop() {
  await cleanLedgerTables();
  await importLedgerPackage(generateMockLedgerPackage({ scenarioId: "external_wallet_pending_attribution" }));
  await importLedgerPackage(
    promotePackageToCassette(generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" }), "cassette_p2_6_deposit_buy_fee")
  );
  await importLedgerPackage(packageAs(generateMockLedgerPackage({ scenarioId: "missing_event_mismatch" }), "remote_export"));
  await runLedgerReconciliation({
    prismaClient: prisma,
    runId: "recon_p2_6_e2e",
    checkedAt: "2026-06-25T00:20:00.000Z"
  });
}

function packageAs(ledgerPackage: LedgerExportPackage, packageKind: LedgerPackageKind): LedgerExportPackage {
  const packageWithoutHash: LedgerExportPackage = {
    ...ledgerPackage,
    manifest: {
      schema_version: "ledger.export.v1",
      package_id: `pkg_p2_6_e2e_${packageKind}_${ledgerPackage.manifest.scenario_id}`,
      package_kind: packageKind,
      export_run_id: `lexp_p2_6_e2e_${packageKind}_${ledgerPackage.manifest.scenario_id}`,
      source_env_id: packageKind === "remote_export" ? "remote-prod-1" : "cassette-fixture",
      sync_run_id: `job_p2_6_e2e_${packageKind}_${ledgerPackage.manifest.scenario_id}`,
      scenario_id: ledgerPackage.manifest.scenario_id,
      cassette_id: packageKind === "cassette" ? `cassette_p2_6_e2e_${ledgerPackage.manifest.scenario_id}` : undefined,
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
