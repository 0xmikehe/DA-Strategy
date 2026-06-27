import React from "react";
import { StatusBadge } from "@/app/_components/phase1/status-badge";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { SourceModeBadge } from "./source-mode-badge";

type PortfolioOverviewProps = {
  model: LedgerPageModel;
};

export function PortfolioOverview({ model }: PortfolioOverviewProps) {
  const { portfolioSummary } = model;
  const accountOptions = portfolioSummary.scopeOptions.filter((option) => option.kind === "account");

  return (
    <div className="stack">
      <section className="metric-strip ledger-overview-strip">
        <div className="metric-card">
          <div className="metric-label">tracked value</div>
          <div className="metric-value">{portfolioSummary.estimatedValueUsd ?? "n/a"}</div>
          <div className="metric-note">仅统计策略追踪资产；未追踪资产不进入估值。</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">accounts / wallets</div>
          <div className="metric-value">{portfolioSummary.accountCount} / {portfolioSummary.walletCount}</div>
          <div className="metric-note">每个入口切到独立账户工作台。</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">asset coverage</div>
          <div className="metric-value">{portfolioSummary.pricedAssetCount} / {portfolioSummary.unpricedAssetCount}</div>
          <div className="metric-note">priced / unpriced assets</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">exceptions</div>
          <div className="metric-value">{portfolioSummary.reconciliationIssueCount} / {portfolioSummary.pendingAttributionCount}</div>
          <div className="metric-note">reconcile issues / pending attribution</div>
        </div>
      </section>

      <div className="grid-ledger">
        <section className="panel">
          <div className="panel-head">
            <span>账户 / 钱包入口</span>
            <span>{accountOptions.length} scope</span>
          </div>
          <div className="panel-body">
            {accountOptions.length === 0 ? (
              <div className="empty-state">暂无账户或钱包入口。</div>
            ) : (
              <div className="account-card-grid">
                {accountOptions.map((option) => (
                  <a className="account-scope-card" href={`/ledger?account=${encodeURIComponent(option.scopeId)}`} key={option.scopeId}>
                    <div className="account-scope-head">
                      <strong>{option.label}</strong>
                      <StatusBadge tone={option.reconciliationIssueCount > 0 ? "risk" : "good"}>
                        {option.reconciliationIssueCount > 0 ? `${option.reconciliationIssueCount} issue` : "matched"}
                      </StatusBadge>
                    </div>
                    <div className="account-scope-metrics">
                      <span>{option.estimatedValueUsd ?? "n/a"} USD</span>
                      <span>{option.assetCount} assets</span>
                      <span>{option.pendingAttributionCount} pending</span>
                    </div>
                    <small>{option.role ?? "account"} · latest {option.latestActivityAt ?? "n/a"}</small>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span>全局待处理摘要</span>
            <StatusBadge tone={portfolioSummary.reconciliationIssueCount + portfolioSummary.pendingAttributionCount > 0 ? "warn" : "good"}>
              {portfolioSummary.reconciliationIssueCount + portfolioSummary.pendingAttributionCount} open
            </StatusBadge>
          </div>
          <div className="panel-body">
            <div className="snapshot-grid">
              <div className="snapshot-item">
                <span>reconcile issues</span>
                <strong>{portfolioSummary.reconciliationIssueCount}</strong>
                <small>进入具体账户后查看差异与快照。</small>
              </div>
              <div className="snapshot-item">
                <span>pending attribution</span>
                <strong>{portfolioSummary.pendingAttributionCount}</strong>
                <small>异常处理动作仅在账户工作台显示。</small>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid-ledger">
        <section className="panel">
          <div className="panel-head">
            <span>追踪资产估值</span>
            <span>{portfolioSummary.assetRows.length} assets</span>
          </div>
          <div className="panel-body tight">
            {portfolioSummary.assetRows.length === 0 ? (
              <div className="empty-state">暂无持仓资产。</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>asset</th>
                    <th className="right">quantity</th>
                    <th className="right">value</th>
                    <th>pricing</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioSummary.assetRows.map((row) => (
                    <tr key={row.asset}>
                      <td>{row.asset}</td>
                      <td className="right">{row.quantity}</td>
                      <td className="right">{row.estimatedValueUsd ?? "unpriced"}</td>
                      <td>{row.priceUsd ? `${row.priceUsd} USD` : row.valuationStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span>最近全局流水</span>
            <span>{portfolioSummary.recentFlowRows.length} rows</span>
          </div>
          <div className="panel-body tight">
            {portfolioSummary.recentFlowRows.length === 0 ? (
              <div className="empty-state">暂无最近流水。</div>
            ) : (
              <table className="data-table overview-flow-table">
                <thead>
                  <tr>
                    <th>fact</th>
                    <th>source</th>
                    <th>account</th>
                    <th className="right">qty</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioSummary.recentFlowRows.map((row) => (
                    <tr key={`${row.factKind}:${row.naturalKey}`}>
                      <td>{row.factKind}</td>
                      <td><SourceModeBadge sourceMode={row.sourceMode} /></td>
                      <td>{row.accountId ?? "n/a"}</td>
                      <td className="right">{row.signedQuantity ?? "n/a"} {row.asset ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
