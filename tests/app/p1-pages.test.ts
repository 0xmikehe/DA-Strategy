import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import LedgerPage from "@/app/ledger/page";
import MarketPage from "@/app/market/page";
import { MarketDataPageView } from "@/app/_components/phase1/market-data-page-view";
import { p15MarketDataHistoryRows } from "@/fixtures/phase1/market-data-history";
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

  it("renders the ledger page with position, trade attribution, and review context", () => {
    const html = renderToStaticMarkup(createElement(LedgerPage));

    expect(html).toContain("账本视图");
    expect(html).toContain("0.10000000");
    expect(html).toContain("trade_2026_06_19_0001");
    expect(html).toContain("fixture_reconciled");
    expect(html).toContain("strategy_version");
    expect(html).not.toContain("key_ref");
    expect(html).not.toContain("raw_payload");
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
