import React from "react";
import type { LedgerPositionView } from "@/contracts/phase1";

type LedgerPositionTableProps = {
  position: LedgerPositionView;
};

export function LedgerPositionTable({ position }: LedgerPositionTableProps) {
  return (
    <section className="panel" aria-labelledby="ledger-position-table-title">
      <div className="panel-head">
        <span id="ledger-position-table-title">策略持仓</span>
        <span>{position.strategy_version}</span>
      </div>
      <div className="panel-body tight">
        <table className="data-table">
          <thead>
            <tr>
              <th>asset</th>
              <th className="right">free_qty</th>
              <th className="right">total_qty</th>
              <th className="right">cost_basis_quote</th>
            </tr>
          </thead>
          <tbody>
            {position.assets.map((asset) => (
              <tr key={asset.asset}>
                <td>{asset.asset}</td>
                <td className="right">{asset.free_qty}</td>
                <td className="right">{asset.total_qty}</td>
                <td className="right">{asset.cost_basis_quote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
