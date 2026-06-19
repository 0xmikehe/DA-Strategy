import type {
  ActiveSignalSet,
  CapitalFlowView,
  LedgerPositionView,
  LedgerTradeView,
  PlannedAction,
  ReviewDraft,
  SignalSnapshotRef
} from "@/contracts/phase1";
import { replayLedgerEvents } from "@/ledger/replay/replay-ledger-events";
import { buildSignalSnapshot } from "@/signal/snapshot/build-signal-snapshot";
import { buildPlannedAction } from "@/strategy/actions/build-planned-action";
import { buildReviewDraft } from "@/strategy/review/build-review-draft";
import {
  p1CapitalFlows,
  p1FixtureIds,
  p1FundingRates,
  p1LedgerEvents,
  p1MarketCandles,
  p1TradeFills
} from "@/fixtures/phase1/walking-skeleton";

export type P1SnapshotSummary = {
  snapshot_id: string;
  signal_count: number;
  input_count: number;
  enabled_signal_ids: string[];
  data_health: ActiveSignalSet["data_health"];
};

export type P1MarketReadModel = {
  activeSignalSet: ActiveSignalSet;
  snapshotRef: SignalSnapshotRef;
  snapshotSummary: P1SnapshotSummary;
  dataHealth: ActiveSignalSet["data_health"];
};

export type P1FixtureStatus = {
  state: "fixture_synced" | "fixture_reconciled";
  source: "fixture";
  last_synced_at?: string;
  checked_at?: string;
};

export type P1Traceability = {
  snapshot_id: string;
  strategy_version: string;
  ledger_event_ids: string[];
  trade_ids: string[];
};

export type P1LedgerReadModel = {
  positionView: LedgerPositionView;
  tradeViews: LedgerTradeView[];
  capitalFlows: CapitalFlowView[];
  plannedAction: PlannedAction;
  reviewDraft: ReviewDraft;
  syncStatus: P1FixtureStatus;
  reconciliationStatus: P1FixtureStatus;
  traceability: P1Traceability;
};

export function getP1MarketReadModel(): P1MarketReadModel {
  const signalSnapshot = buildP1FixtureSnapshot();

  return {
    activeSignalSet: signalSnapshot.content.active_signal_set,
    snapshotRef: signalSnapshot.ref,
    snapshotSummary: {
      snapshot_id: signalSnapshot.content.snapshot_id,
      signal_count: signalSnapshot.content.active_signal_set.signals.length,
      input_count: signalSnapshot.content.input_refs.length,
      enabled_signal_ids: signalSnapshot.content.active_signal_set.signals.map((signal) => signal.signal_id),
      data_health: signalSnapshot.content.data_health
    },
    dataHealth: signalSnapshot.content.data_health
  };
}

export function getP1LedgerReadModel(): P1LedgerReadModel {
  const signalSnapshot = buildP1FixtureSnapshot();
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

  return {
    positionView: ledgerReplay.position_view,
    tradeViews: ledgerReplay.trade_views,
    capitalFlows: ledgerReplay.capital_flow_views,
    plannedAction,
    reviewDraft,
    syncStatus: {
      state: "fixture_synced",
      source: "fixture",
      last_synced_at: "2026-06-19T00:05:00.000Z"
    },
    reconciliationStatus: {
      state: "fixture_reconciled",
      source: "fixture",
      checked_at: "2026-06-19T00:05:00.000Z"
    },
    traceability: {
      snapshot_id: signalSnapshot.ref.snapshot_id,
      strategy_version: plannedAction.strategy_version,
      ledger_event_ids: p1LedgerEvents.map((event) => event.event_id),
      trade_ids: ledgerReplay.trade_views.map((trade) => trade.trade_id)
    }
  };
}

function buildP1FixtureSnapshot() {
  return buildSignalSnapshot({
    snapshot_id: p1FixtureIds.snapshotId,
    evaluated_at: p1FixtureIds.evaluatedAt,
    schema_version: "phase1.snapshot.v1",
    market_candles: p1MarketCandles,
    funding_rates: p1FundingRates
  });
}
