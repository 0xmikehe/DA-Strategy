import React from "react";
import { AppShell } from "../_components/phase1/app-shell";
import { LedgerPositionTable } from "../_components/phase1/ledger-position-table";
import { StatusBadge } from "../_components/phase1/status-badge";
import { TradeAttributionTable } from "../_components/phase1/trade-attribution-table";
import { getP1LedgerReadModel } from "@/server/read-model/p1-walking-skeleton";

export default function LedgerPage() {
  const ledger = getP1LedgerReadModel();

  return (
    <AppShell active="ledger" context={ledger.traceability.snapshot_id} title="账本视图">
      <main className="page-frame">
        <header className="page-head">
          <div>
            <p className="page-kicker">Ledger / Replay View</p>
            <h1 className="page-title">账本视图</h1>
            <p className="page-summary">
              P1 账本页展示 fixture 账户事件的回放结果：持仓、成交归属、资金流、计划动作和复盘草稿共享同一条追溯链。
            </p>
          </div>
          <div className="action-row">
            <StatusBadge tone="good">{ledger.syncStatus.state}</StatusBadge>
            <StatusBadge tone="good">{ledger.reconciliationStatus.state}</StatusBadge>
          </div>
        </header>

        <section className="stack">
          <div className="metric-strip">
            <div className="metric-card">
              <div className="metric-label">strategy_version</div>
              <div className="metric-value">{ledger.traceability.strategy_version}</div>
              <div className="metric-note">core_allocation_lt@v1</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">snapshot_id</div>
              <div className="metric-value accent">{ledger.traceability.snapshot_id}</div>
              <div className="metric-note">成交与计划动作绑定同一快照。</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">trade_ids</div>
              <div className="metric-value">{ledger.traceability.trade_ids.length}</div>
              <div className="metric-note">{ledger.traceability.trade_ids.join(", ")}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">planned_action</div>
              <div className="metric-value">{ledger.plannedAction.action_type}</div>
              <div className="metric-note">{ledger.plannedAction.target_allocation_band_ref}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">review</div>
              <div className="metric-value">{ledger.reviewDraft.status}</div>
              <div className="metric-note">{ledger.reviewDraft.review_id}</div>
            </div>
          </div>

          <div className="grid-ledger">
            <div className="stack">
              <LedgerPositionTable position={ledger.positionView} />
              <TradeAttributionTable trades={ledger.tradeViews} />
              <section className="panel">
                <div className="panel-head">
                  <span>资金流</span>
                  <span>{ledger.capitalFlows.length} flow</span>
                </div>
                <div className="panel-body tight">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>event_id</th>
                        <th>flow_type</th>
                        <th className="right">asset</th>
                        <th className="right">amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.capitalFlows.map((flow) => (
                        <tr key={flow.event_id}>
                          <td>{flow.event_id}</td>
                          <td>{flow.flow_type}</td>
                          <td className="right">{flow.asset}</td>
                          <td className="right positive">{flow.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="stack">
              <section className="panel">
                <div className="panel-head">
                  <span>计划动作</span>
                  <StatusBadge tone="warn">{ledger.plannedAction.status}</StatusBadge>
                </div>
                <div className="panel-body">
                  <div className="snapshot-grid">
                    <div className="snapshot-item">
                      <span>action_id</span>
                      <strong>{ledger.plannedAction.action_id}</strong>
                    </div>
                    <div className="snapshot-item">
                      <span>action_type</span>
                      <strong>{ledger.plannedAction.action_type}</strong>
                    </div>
                    <div className="snapshot-item">
                      <span>strategy_version</span>
                      <strong>{ledger.plannedAction.strategy_version}</strong>
                    </div>
                    <div className="snapshot-item">
                      <span>snapshot_id</span>
                      <strong>{ledger.plannedAction.snapshot_id}</strong>
                    </div>
                  </div>
                  <div className="badge-row align-left">
                    {ledger.plannedAction.reason_codes.map((reason) => (
                      <StatusBadge key={reason}>{reason}</StatusBadge>
                    ))}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <span>复盘草稿</span>
                  <StatusBadge tone="warn">{ledger.reviewDraft.status}</StatusBadge>
                </div>
                <div className="panel-body">
                  <div className="review-section">
                    {ledger.reviewDraft.sections.map((section) => (
                      <div className="review-item" key={section.key}>
                        <b>{section.title}</b>
                        <span>{section.body}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <span>追溯链</span>
                  <span>audit trail</span>
                </div>
                <div className="panel-body">
                  <div className="snapshot-grid">
                    <div className="snapshot-item">
                      <span>ledger_event_ids</span>
                      <strong>{ledger.traceability.ledger_event_ids.join(", ")}</strong>
                    </div>
                    <div className="snapshot-item">
                      <span>trade_ids</span>
                      <strong>{ledger.traceability.trade_ids.join(", ")}</strong>
                    </div>
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
