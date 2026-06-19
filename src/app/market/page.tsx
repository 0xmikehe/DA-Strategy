import React from "react";
import { AppShell } from "../_components/phase1/app-shell";
import { MarketSignalTable } from "../_components/phase1/market-signal-table";
import { SnapshotSummary } from "../_components/phase1/snapshot-summary";
import { StatusBadge } from "../_components/phase1/status-badge";
import { getP1MarketReadModel } from "@/server/read-model/p1-walking-skeleton";

export default function MarketPage() {
  const market = getP1MarketReadModel();
  const riskRegime = market.activeSignalSet.signals.find((signal) => signal.signal_id === "risk_regime");
  const coreTilt = market.activeSignalSet.signals.find((signal) => signal.signal_id === "core_tilt");
  const funding = market.activeSignalSet.signals.find((signal) => signal.signal_id === "funding_sentiment");

  return (
    <AppShell active="market" context={market.snapshotRef.snapshot_id} title="市场信号">
      <main className="page-frame">
        <header className="page-head">
          <div>
            <p className="page-kicker">Market / Signal Snapshot</p>
            <h1 className="page-title">市场信号</h1>
            <p className="page-summary">
              P1 市场页展示 fixture 行情事实生成的启用态信号。页面只消费 read model summary，不暴露 content_json 或原始行情 payload。
            </p>
          </div>
          <div className="action-row">
            <StatusBadge tone="good">{market.dataHealth}</StatusBadge>
            <StatusBadge tone="frozen">快照已冻结</StatusBadge>
          </div>
        </header>

        <section className="stack">
          <div className="metric-strip">
            <div className="metric-card">
              <div className="metric-label">risk_regime</div>
              <div className="metric-value positive">{riskRegime?.value ?? "missing"}</div>
              <div className="metric-note">{riskRegime?.reason_codes.join(", ")}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">core_tilt</div>
              <div className="metric-value accent">{coreTilt?.value ?? "missing"}</div>
              <div className="metric-note">{coreTilt?.reason_codes.join(", ")}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">funding_sentiment</div>
              <div className="metric-value">{funding?.value ?? "missing"}</div>
              <div className="metric-note">{funding?.raw_value}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">input_refs</div>
              <div className="metric-value">{market.snapshotSummary.input_count}</div>
              <div className="metric-note">market_candle_fact + funding_rate_fact</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">schema_version</div>
              <div className="metric-value">phase1</div>
              <div className="metric-note">{market.snapshotRef.schema_version}</div>
            </div>
          </div>

          <div className="grid-market">
            <div className="stack">
              <section className="panel">
                <div className="panel-head">
                  <span>BTC 趋势结构</span>
                  <span>{market.activeSignalSet.as_of}</span>
                </div>
                <div className="chart-panel">
                  <div className="chart-line" />
                </div>
              </section>
              <MarketSignalTable signals={market.activeSignalSet.signals} />
            </div>

            <div className="stack">
              <SnapshotSummary contentHash={market.snapshotRef.content_hash} summary={market.snapshotSummary} />
              <section className="panel">
                <div className="panel-head">
                  <span>信号历史</span>
                  <span>fixture timeline</span>
                </div>
                <div className="panel-body">
                  <div className="timeline">
                    {market.activeSignalSet.signals.map((signal) => (
                      <div className="timeline-row" key={signal.signal_id}>
                        <div className="timeline-time">00:00</div>
                        <div className="timeline-rail">
                          <span className="timeline-dot" />
                        </div>
                        <div>
                          <div className="timeline-title">{signal.signal_id}</div>
                          <div className="timeline-meta">
                            {signal.value} · {signal.reason_codes.join(", ")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
