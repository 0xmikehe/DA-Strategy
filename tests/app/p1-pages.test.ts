import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { LedgerPageView } from "@/app/ledger/components/ledger-page-view";
import MarketPage from "@/app/market/page";
import { MarketDataPageView } from "@/app/_components/phase1/market-data-page-view";
import { p15MarketDataHistoryRows } from "@/fixtures/phase1/market-data-history";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { buildP15MarketDataReadModel } from "@/server/read-model/p15-market-data";

describe("P1 product pages", () => {
  it("renders the P1 home page as a product workspace entry, not the P0 placeholder", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain("数字资产投资操作系统");
    expect(html).toContain("市场页");
    expect(html).toContain("行情数据页");
    expect(html).toContain("账本页");
    expect(html).not.toContain("工程骨架施工中");
  });

  it("renders the market page from the P1 read model", () => {
    const html = renderToStaticMarkup(createElement(MarketPage));

    expect(html).toContain("市场信号");
    expect(html).toContain("snap_2026_06_19_0001");
    expect(html).toContain("risk_regime");
    expect(html).toContain("funding_sentiment");
    expect(html).toContain("complete");
    expect(html).not.toContain("raw_payload");
  });

  it("renders the P2 ledger page with source mode, reconciliation, pending attribution, and no secrets", () => {
    const html = renderToStaticMarkup(createElement(LedgerPageView, { model: ledgerPageModelFixture() }));

    expect(html).toContain("账本工作台");
    expect(html).toContain("remote_import");
    expect(html).toContain("+9999.00");
    expect(html).toContain("待归属交易队列");
    expect(html).toContain("manual_external_trade:req_ext_pending");
    expect(html).toContain("no balance edit");
    expect(html).not.toContain("key_ref");
    expect(html).not.toContain("raw_payload");
  });

  it("keeps DB-backed ledger pages out of static prerendering", async () => {
    const pageSource = await readFile("src/app/ledger/page.tsx", "utf8");

    expect(pageSource).toContain('export const dynamic = "force-dynamic";');
  });

  it("renders the P1.5 market data page from a read model without raw payloads", () => {
    const model = buildP15MarketDataReadModel({
      rows: p15MarketDataHistoryRows,
      generatedAt: new Date("2026-06-20T03:10:00.000Z")
    });
    const html = renderToStaticMarkup(createElement(MarketDataPageView, { marketData: model }));

    expect(html).toContain("行情数据");
    expect(html).toContain("Open interest");
    expect(html).toContain("Top trader positions");
    expect(html).toContain("mdf_2026_06_20_0200_oi");
    expect(html).toContain("partial");
    expect(html).not.toContain("raw_payload");
    expect(html).not.toContain("rawPayload");
  });

  it("keeps Soft Midnight tokens and 2560px widescreen layout hooks in global CSS", async () => {
    const css = await readFile("src/app/globals.css", "utf8");

    expect(css).toContain("--bg: #070b12");
    expect(css).toContain("--panel: #0d141f");
    expect(css).toContain("--blue: #4ea3d8");
    expect(css).toContain("--radius-panel: 6px");
    expect(css).toContain("@media (min-width: 2560px)");
    expect(css).toContain("--workspace-max: 2240px");
    expect(css).toContain("repeat(4, 38px)");
  });
});

function ledgerPageModelFixture(): LedgerPageModel {
  return {
    generatedAt: "2026-06-27T00:00:00.000Z",
    freshness: {
      state: "stale",
      label: "数据陈旧 stale",
      latestAt: "2026-06-25T00:20:00.000Z"
    },
    sourceSummary: {
      totalFacts: 3,
      modes: [
        { sourceMode: "mock", batchCount: 1, factCount: 1, latestRequestedAt: "2026-06-25T00:08:00.000Z" },
        { sourceMode: "remote_import", batchCount: 1, factCount: 1, latestRequestedAt: "2026-06-25T00:07:00.000Z" }
      ]
    },
    reconciliation: {
      rows: [
        {
          runId: "recon_p2_6",
          accountId: "acct_mock_core_spot",
          asset: "USDT",
          computedQty: "0.00000000",
          reportedQty: "9999.00",
          diffQty: "9999.00",
          signedDiff: "+9999.00",
          thresholdQty: "0.00000001",
          status: "MISSING_EVENT",
          label: "疑似漏事件",
          tone: "risk",
          checkedAt: "2026-06-25T00:20:00.000Z",
          snapshotRef: "snapshot:acct_mock_core_spot:USDT:2026-06-25T00:07:00.000Z:spot_total"
        }
      ]
    },
    pendingAttribution: {
      items: [
        {
          factKind: "external_trade",
          idempotencyKey: "manual_external_trade:req_ext_pending",
          sourceMode: "mock",
          accountId: "acct_mock_core_spot",
          asset: "ETH",
          quantity: "0.50000000",
          occurredAt: "2026-06-25T00:08:00.000Z",
          suggestedReason: "missing_attribution",
          attributionState: "pending"
        }
      ]
    },
    flows: {
      rows: [
        {
          factKind: "external_trade",
          idempotencyKey: "manual_external_trade:req_ext_pending",
          naturalKey: "external:wallet:eth:001",
          sourceMode: "mock",
          originKind: "mock_scenario",
          accountId: "acct_mock_core_spot",
          asset: "ETH",
          quantity: "0.50000000",
          signedQuantity: "+0.50000000",
          side: "BUY",
          occurredAt: "2026-06-25T00:08:00.000Z"
        }
      ]
    },
    externalTradeFormOptions: {
      accounts: ["acct_mock_core_spot"],
      assets: ["BTC", "ETH", "USDT"],
      defaultQuoteAsset: "USDT",
      strategyOptions: [{ strategyId: "core_allocation_lt", strategyVersion: "v1", label: "core_allocation_lt@v1" }]
    },
    bindingHealth: {
      state: "WARN",
      label: "binding/key health summary unavailable",
      safeReason: "offline page loop"
    },
    capabilities: {
      manualSync: false,
      requestReconciliation: true,
      attribution: true,
      reversal: true,
      externalTradeEntry: true,
      liveRuntime: false
    }
  };
}
