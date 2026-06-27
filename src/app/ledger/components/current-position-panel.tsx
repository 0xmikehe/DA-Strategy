import React from "react";
import { StatusBadge } from "@/app/_components/phase1/status-badge";
import type { LedgerPageModel, LedgerPagePositionRow } from "@/ledger/page-model/types";

type CurrentPositionPanelProps = {
  currentPositions: LedgerPageModel["currentPositions"];
};

export function CurrentPositionPanel({ currentPositions }: CurrentPositionPanelProps) {
  const issueCount = currentPositions.accountRows.filter((row) => row.reconciliationTone && row.reconciliationTone !== "good").length;

  return (
    <section className="panel">
      <div className="panel-head">
        <span>当前持仓</span>
        <div className="action-row compact">
          <StatusBadge tone={issueCount > 0 ? "risk" : "good"}>{issueCount > 0 ? `${issueCount} reconcile issue` : "replay clean"}</StatusBadge>
          <StatusBadge tone="frozen">{currentPositions.eventCount} events</StatusBadge>
        </div>
      </div>
      <div className="panel-body">
        <div className="position-grid">
          <PositionTable emptyText="暂无账户余额。" rows={currentPositions.accountRows} title="账户余额" />
          <PositionTable emptyText="暂无策略归属持仓。" rows={currentPositions.strategyRows} title="策略归属持仓" />
          <PositionTable emptyText="暂无未分配余额。" rows={currentPositions.unassignedRows} title="未分配池" />
        </div>
        {currentPositions.diagnostics.length > 0 ? (
          <div className="position-diagnostics">
            {currentPositions.diagnostics.slice(0, 3).map((diagnostic) => (
              <span key={`${diagnostic.code}:${diagnostic.factIdempotencyKey ?? diagnostic.message}`}>{diagnostic.code}</span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PositionTable({
  title,
  rows,
  emptyText
}: {
  title: string;
  rows: LedgerPagePositionRow[];
  emptyText: string;
}) {
  return (
    <div className="position-card">
      <div className="position-card-head">
        <span>{title}</span>
        <small>{rows.length} assets</small>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state compact">{emptyText}</div>
      ) : (
        <table className="data-table position-table">
          <thead>
            <tr>
              <th>scope</th>
              <th className="right">quantity</th>
              <th className="right">value</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.scopeType}:${row.scopeId}:${row.asset}`}>
                <td>
                  <span className="cell-main">{row.scopeId}</span>
                  <small>{row.scopeType}</small>
                </td>
                <td className={`right ${row.signedQuantity.startsWith("-") ? "negative" : "positive"}`}>
                  {row.quantity} {row.asset}
                </td>
                <td className="right">
                  {row.estimatedValueUsd ? `${row.estimatedValueUsd} USD` : row.valuationStatus ?? "n/a"}
                </td>
                <td>
                  {row.reconciliationLabel ? (
                    <StatusBadge tone={row.reconciliationTone ?? "warn"}>{row.reconciliationLabel}</StatusBadge>
                  ) : (
                    <span className="muted-text">n/a</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
