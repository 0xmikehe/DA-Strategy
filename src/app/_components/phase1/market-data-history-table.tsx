import React from "react";
import type { MarketDataFactRow } from "@/contracts/p15-market-data";

type MarketDataHistoryTableProps = {
  rows: MarketDataFactRow[];
};

export function MarketDataHistoryTable({ rows }: MarketDataHistoryTableProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span>采集历史</span>
        <span>{rows.length} rows</span>
      </div>
      <div className="panel-body tight">
        <table className="data-table market-data-history">
          <thead>
            <tr>
              <th>fact_id</th>
              <th>fact_type</th>
              <th>event_time</th>
              <th>collected_at</th>
              <th className="right">value</th>
              <th className="right">hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.fact_type}</td>
                <td>{formatTime(row.event_time)}</td>
                <td>{formatTime(row.collected_at)}</td>
                <td className="right">
                  <span className="accent">{row.primary_value}</span>
                  <small>{row.value_label}</small>
                </td>
                <td className="right faint">{row.content_hash.slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatTime(value: string) {
  return value.replace(".000Z", "Z");
}
