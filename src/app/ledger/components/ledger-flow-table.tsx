import React from "react";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { SourceModeBadge } from "./source-mode-badge";

type LedgerFlowTableProps = {
  flows: LedgerPageModel["flows"];
};

export function LedgerFlowTable({ flows }: LedgerFlowTableProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span>流水查询</span>
        <span>{flows.rows.length} rows</span>
      </div>
      <div className="panel-body tight flow-scroll">
        {flows.rows.length === 0 ? (
          <div className="empty-state">暂无流水。</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>fact</th>
                <th>source</th>
                <th>origin</th>
                <th>account</th>
                <th className="right">quantity</th>
                <th>snapshot</th>
              </tr>
            </thead>
            <tbody>
              {flows.rows.map((row) => (
                <tr key={`${row.factKind}:${row.idempotencyKey}`}>
                  <td>
                    <span className="cell-main">{row.factKind}</span>
                    <small>{row.naturalKey}</small>
                  </td>
                  <td><SourceModeBadge sourceMode={row.sourceMode} /></td>
                  <td>{row.originKind}</td>
                  <td>{row.accountId ?? "n/a"}</td>
                  <td className={`right ${row.signedQuantity?.startsWith("-") ? "negative" : row.signedQuantity ? "positive" : ""}`}>
                    {row.signedQuantity ?? "n/a"} {row.asset ?? ""}
                  </td>
                  <td>{row.snapshotId ?? "missing_snapshot"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
