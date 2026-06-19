import React from "react";
import type { ActiveSignal } from "@/contracts/phase1";
import { StatusBadge } from "./status-badge";

type MarketSignalTableProps = {
  signals: ActiveSignal[];
};

export function MarketSignalTable({ signals }: MarketSignalTableProps) {
  return (
    <section className="panel" aria-labelledby="market-signal-table-title">
      <div className="panel-head">
        <span id="market-signal-table-title">启用态信号</span>
        <span>ActiveSignalSet</span>
      </div>
      <div className="panel-body tight">
        <table className="data-table">
          <thead>
            <tr>
              <th>signal_id</th>
              <th>value</th>
              <th>raw_value</th>
              <th className="right">state</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.signal_id}>
                <td>{signal.signal_id}</td>
                <td className={signal.value === "risk_on" ? "positive" : "accent"}>{signal.value}</td>
                <td>{signal.raw_value}</td>
                <td className="right">
                  <StatusBadge tone="good">{signal.lifecycle_state}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
