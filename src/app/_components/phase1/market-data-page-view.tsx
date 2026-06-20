import React from "react";
import type { P15MarketDataReadModel } from "@/contracts/p15-market-data";
import { AppShell } from "./app-shell";
import { MarketDataHistoryTable } from "./market-data-history-table";
import { MarketDataMetricPanel } from "./market-data-metric-panel";
import { StatusBadge } from "./status-badge";

type MarketDataPageViewProps = {
  marketData: P15MarketDataReadModel;
};

export function MarketDataPageView({ marketData }: MarketDataPageViewProps) {
  const latestEventTime = marketData.history[0]?.event_time ?? "empty";

  return (
    <AppShell
      active="marketData"
      badges={
        <>
          <StatusBadge tone={marketData.collector_state === "shadow_collecting" ? "good" : "warn"}>
            {marketData.collector_state}
          </StatusBadge>
          <StatusBadge tone="frozen">shadow only</StatusBadge>
        </>
      }
      context={`${marketData.selected_symbol} / ${marketData.selected_period}`}
      title="行情数据"
    >
      <main className="page-frame">
        <header className="page-head">
          <div>
            <p className="page-kicker">Market Data / Shadow Collector</p>
            <h1 className="page-title">行情数据</h1>
            <p className="page-summary">
              P1.5 展示 Binance USDⓈ-M public futures-data 的影子采集结果：最新值、采集延迟、缺口和历史记录。
            </p>
          </div>
          <div className="action-row">
            <StatusBadge tone={marketData.collector_state === "shadow_collecting" ? "good" : "warn"}>
              {marketData.collector_state}
            </StatusBadge>
            <StatusBadge>{marketData.mode}</StatusBadge>
          </div>
        </header>

        <section className="stack">
          <div className="metric-strip market-data-strip">
            <div className="metric-card">
              <div className="metric-label">source</div>
              <div className="metric-value">Binance</div>
              <div className="metric-note">{marketData.source}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">last_success_at</div>
              <div className="metric-value accent">{formatCompactTime(marketData.last_success_at)}</div>
              <div className="metric-note">最后一条成功入库的 collected_at。</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">latest_event_time</div>
              <div className="metric-value">{formatCompactTime(latestEventTime)}</div>
              <div className="metric-note">市场事实自身的 event_time。</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">history_rows</div>
              <div className="metric-value">{marketData.history.length}</div>
              <div className="metric-note">{marketData.selected_range} window</div>
            </div>
          </div>

          <div className="market-data-grid">
            <div className="market-data-metrics">
              {marketData.metrics.map((metric) => (
                <MarketDataMetricPanel key={metric.fact_type} metric={metric} />
              ))}
            </div>

            <section className="panel">
              <div className="panel-head">
                <span>采集上下文</span>
                <span>{marketData.generated_at}</span>
              </div>
              <div className="panel-body">
                <div className="snapshot-grid">
                  <div className="snapshot-item">
                    <span>symbol</span>
                    <strong>{marketData.selected_symbol}</strong>
                  </div>
                  <div className="snapshot-item">
                    <span>period</span>
                    <strong>{marketData.selected_period}</strong>
                  </div>
                  <div className="snapshot-item">
                    <span>symbols</span>
                    <strong>{marketData.symbols.join(", ")}</strong>
                  </div>
                  <div className="snapshot-item">
                    <span>periods</span>
                    <strong>{marketData.periods.join(", ")}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <MarketDataHistoryTable rows={marketData.history} />
        </section>
      </main>
    </AppShell>
  );
}

function formatCompactTime(value?: string) {
  if (!value) {
    return "empty";
  }

  return value.replace("2026-", "").replace(".000Z", "Z");
}
