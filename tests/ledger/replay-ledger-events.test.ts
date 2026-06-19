import { describe, expect, it } from "vitest";
import {
  capitalFlowViewSchema,
  ledgerPositionViewSchema,
  ledgerTradeViewSchema
} from "@/contracts/phase1.schemas";
import { replayLedgerEvents } from "@/ledger/replay/replay-ledger-events";
import {
  expectedLedgerPositionView,
  p1CapitalFlows,
  p1FixtureIds,
  p1LedgerEvents,
  p1TradeFills
} from "../fixtures/phase1/walking-skeleton";

describe("replayLedgerEvents", () => {
  it("turns fixture ledger events into deterministic trade, flow, and position views", () => {
    const replay = replayLedgerEvents({
      strategy_id: p1FixtureIds.strategyId,
      strategy_version: p1FixtureIds.strategyVersion,
      as_of: "2026-06-19T00:05:00.000Z",
      ledger_events: p1LedgerEvents,
      trade_fills: p1TradeFills,
      capital_flows: p1CapitalFlows
    });

    expect(ledgerPositionViewSchema.parse(replay.position_view)).toEqual(expectedLedgerPositionView);
    expect(replay.trade_views.map((trade) => ledgerTradeViewSchema.parse(trade))).toEqual([
      {
        trade_id: "trade_2026_06_19_0001",
        exchange_account_id: p1FixtureIds.exchangeAccountId,
        strategy_id: p1FixtureIds.strategyId,
        strategy_version: p1FixtureIds.strategyVersion,
        snapshot_id: p1FixtureIds.snapshotId,
        symbol: "BTCUSDT",
        side: "buy",
        price: "65000.00000000",
        qty: "0.10000000",
        commission_asset: "USDT",
        commission_qty: "6.50000000",
        time: "2026-06-19T00:05:00.000Z"
      }
    ]);
    expect(replay.capital_flow_views.map((flow) => capitalFlowViewSchema.parse(flow))).toEqual([
      {
        event_id: "flow_2026_06_19_0001",
        strategy_id: p1FixtureIds.strategyId,
        flow_type: "transfer_in",
        asset: "USDT",
        amount: "10000.00000000",
        event_time: "2026-06-19T00:01:00.000Z",
        source_account: "external_wallet",
        target_account: p1FixtureIds.exchangeAccountId
      }
    ]);
  });
});
