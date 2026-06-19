import { describe, expect, it } from "vitest";
import { buildSignalSnapshot } from "@/signal/snapshot/build-signal-snapshot";
import { replayLedgerEvents } from "@/ledger/replay/replay-ledger-events";
import { buildPlannedAction } from "@/strategy/actions/build-planned-action";
import { buildReviewDraft } from "@/strategy/review/build-review-draft";
import {
  p1CapitalFlows,
  p1FixtureIds,
  p1FundingRates,
  p1LedgerEvents,
  p1MarketCandles,
  p1TradeFills
} from "../fixtures/phase1/walking-skeleton";

describe("P1 walking skeleton", () => {
  it("runs market facts to snapshot to plan to ledger replay to review with traceability", () => {
    const signalSnapshot = buildSignalSnapshot({
      snapshot_id: p1FixtureIds.snapshotId,
      evaluated_at: p1FixtureIds.evaluatedAt,
      schema_version: "phase1.snapshot.v1",
      market_candles: p1MarketCandles,
      funding_rates: p1FundingRates
    });
    const ledgerReplay = replayLedgerEvents({
      strategy_id: p1FixtureIds.strategyId,
      strategy_version: p1FixtureIds.strategyVersion,
      as_of: "2026-06-19T00:05:00.000Z",
      ledger_events: p1LedgerEvents,
      trade_fills: p1TradeFills,
      capital_flows: p1CapitalFlows
    });
    const plannedAction = buildPlannedAction({
      active_signal_set: signalSnapshot.content.active_signal_set,
      ledger_position: ledgerReplay.position_view
    });
    const reviewDraft = buildReviewDraft({
      period_start: "2026-06-19T00:00:00.000Z",
      period_end: "2026-06-20T00:00:00.000Z",
      snapshot_refs: [signalSnapshot.ref],
      planned_action: plannedAction,
      ledger_position: ledgerReplay.position_view,
      trade_views: ledgerReplay.trade_views
    });

    expect(signalSnapshot.content.snapshot_id).toBe(p1FixtureIds.snapshotId);
    expect(plannedAction.snapshot_id).toBe(signalSnapshot.ref.snapshot_id);
    expect(plannedAction.strategy_version).toBe(p1FixtureIds.strategyVersion);
    expect(ledgerReplay.trade_views[0]?.snapshot_id).toBe(signalSnapshot.ref.snapshot_id);
    expect(ledgerReplay.trade_views[0]?.trade_id).toBe("trade_2026_06_19_0001");
    expect(reviewDraft.snapshot_refs[0]?.snapshot_id).toBe(signalSnapshot.ref.snapshot_id);
    expect(reviewDraft.strategy_version).toBe(p1FixtureIds.strategyVersion);
    expect(reviewDraft.sections.map((section) => section.key)).toEqual(["market", "ledger", "action"]);
  });
});
