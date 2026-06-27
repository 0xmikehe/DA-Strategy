import React from "react";
import { StatusBadge } from "@/app/_components/phase1/status-badge";
import type { LedgerPageModel } from "@/ledger/page-model/types";

type ReconciliationPanelProps = {
  reconciliation: LedgerPageModel["reconciliation"];
};

export function ReconciliationPanel({ reconciliation }: ReconciliationPanelProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span>对账面板</span>
        <span>{reconciliation.rows.length} result</span>
      </div>
      <div className="panel-body tight">
        {reconciliation.rows.length === 0 ? (
          <div className="empty-state">暂无对账结果。导入 mock/cassette/remote_import 后可手工运行对账。</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>account</th>
                <th>asset</th>
                <th className="right">computed</th>
                <th className="right">reported</th>
                <th className="right">diff</th>
                <th>status</th>
                <th>checked</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.rows.map((row) => (
                <tr key={`${row.runId}:${row.accountId}:${row.asset}:${row.checkedAt}`}>
                  <td>{row.accountId}</td>
                  <td>{row.asset}</td>
                  <td className="right">{row.computedQty}</td>
                  <td className="right">{row.reportedQty ?? "missing"}</td>
                  <td className={`right ${row.signedDiff.startsWith("-") ? "negative" : row.signedDiff === "0.00000000" ? "" : "warning"}`}>
                    {row.signedDiff}
                  </td>
                  <td>
                    <StatusBadge tone={row.tone}>{row.label}</StatusBadge>
                  </td>
                  <td>{row.checkedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
