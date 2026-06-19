import React from "react";
import type { LedgerTradeView } from "@/contracts/phase1";

type TradeAttributionTableProps = {
  trades: LedgerTradeView[];
};

export function TradeAttributionTable({ trades }: TradeAttributionTableProps) {
  return (
    <section className="panel" aria-labelledby="trade-attribution-table-title">
      <div className="panel-head">
        <span id="trade-attribution-table-title">成交归属</span>
        <span>snapshot + strategy_version</span>
      </div>
      <div className="panel-body tight">
        <table className="data-table">
          <thead>
            <tr>
              <th>trade_id</th>
              <th>symbol</th>
              <th className="right">qty</th>
              <th className="right">snapshot_id</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.trade_id}>
                <td>{trade.trade_id}</td>
                <td>{trade.symbol}</td>
                <td className="right">{trade.qty}</td>
                <td className="right">{trade.snapshot_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
