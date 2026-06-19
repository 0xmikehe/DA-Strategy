import type {
  ActiveSignalSet,
  AssetPoolItem,
  LedgerPositionView,
  PlannedAction,
  ReviewDraft,
  StrategyBindingRef,
  StrategyVersionRef
} from "@/contracts/phase1";

export const p1FixtureIds = {
  snapshotId: "snap_2026_06_19_0001",
  strategyId: "core_allocation_lt",
  strategyVersion: "v1",
  exchangeAccountId: "acct_fixture_core",
  evaluatedAt: "2026-06-19T00:00:00.000Z"
} as const;

export const p1StrategyVersion = {
  strategy_id: p1FixtureIds.strategyId,
  strategy_version: p1FixtureIds.strategyVersion,
  effective_from: "2026-06-01T00:00:00.000Z",
  status: "active"
} satisfies StrategyVersionRef;

export const p1AssetPoolItems = [
  {
    strategy_id: p1FixtureIds.strategyId,
    strategy_version: p1FixtureIds.strategyVersion,
    asset: "USDT",
    role: "stable",
    status: "active",
    effective_from: "2026-06-01T00:00:00.000Z"
  },
  {
    strategy_id: p1FixtureIds.strategyId,
    strategy_version: p1FixtureIds.strategyVersion,
    asset: "BTC",
    role: "core",
    status: "active",
    effective_from: "2026-06-01T00:00:00.000Z"
  },
  {
    strategy_id: p1FixtureIds.strategyId,
    strategy_version: p1FixtureIds.strategyVersion,
    asset: "ETH",
    role: "core",
    status: "active",
    effective_from: "2026-06-01T00:00:00.000Z"
  },
  {
    strategy_id: p1FixtureIds.strategyId,
    strategy_version: p1FixtureIds.strategyVersion,
    asset: "SOL",
    role: "satellite",
    status: "active",
    effective_from: "2026-06-01T00:00:00.000Z"
  },
  {
    strategy_id: p1FixtureIds.strategyId,
    strategy_version: p1FixtureIds.strategyVersion,
    asset: "BNB",
    role: "fee_asset",
    status: "active",
    effective_from: "2026-06-01T00:00:00.000Z"
  }
] satisfies AssetPoolItem[];

export const p1StrategyBinding = {
  strategy_id: p1FixtureIds.strategyId,
  strategy_version: p1FixtureIds.strategyVersion,
  exchange_account_id: p1FixtureIds.exchangeAccountId,
  binding_state: "active",
  effective_from: "2026-06-01T00:00:00.000Z"
} satisfies StrategyBindingRef;

export const p1ExchangeAccount = {
  id: p1FixtureIds.exchangeAccountId,
  exchange: "binance",
  account_role: "fixture",
  account_label: "Fixture Core Strategy Account",
  external_account_ref: null,
  key_ref: null
} as const;

export const p1MarketCandles = [
  {
    source: "binance_fixture",
    symbol: "BTCUSDT",
    interval: "1d",
    open_time: "2026-06-18T00:00:00.000Z",
    close_time: "2026-06-18T23:59:59.000Z",
    open: "62000.00000000",
    high: "64000.00000000",
    low: "61000.00000000",
    close: "63000.00000000",
    volume: "1000.00000000",
    raw_payload: { fixture: true }
  },
  {
    source: "binance_fixture",
    symbol: "BTCUSDT",
    interval: "1d",
    open_time: "2026-06-19T00:00:00.000Z",
    close_time: "2026-06-19T23:59:59.000Z",
    open: "63000.00000000",
    high: "66000.00000000",
    low: "62500.00000000",
    close: "65000.00000000",
    volume: "1200.00000000",
    raw_payload: { fixture: true }
  },
  {
    source: "binance_fixture",
    symbol: "ETHUSDT",
    interval: "1d",
    open_time: "2026-06-19T00:00:00.000Z",
    close_time: "2026-06-19T23:59:59.000Z",
    open: "3300.00000000",
    high: "3600.00000000",
    low: "3200.00000000",
    close: "3500.00000000",
    volume: "8000.00000000",
    raw_payload: { fixture: true }
  },
  {
    source: "binance_fixture",
    symbol: "ETHBTC",
    interval: "1d",
    open_time: "2026-06-18T00:00:00.000Z",
    close_time: "2026-06-18T23:59:59.000Z",
    open: "0.04900000",
    high: "0.05200000",
    low: "0.04800000",
    close: "0.05000000",
    volume: "500.00000000",
    raw_payload: { fixture: true }
  },
  {
    source: "binance_fixture",
    symbol: "ETHBTC",
    interval: "1d",
    open_time: "2026-06-19T00:00:00.000Z",
    close_time: "2026-06-19T23:59:59.000Z",
    open: "0.05000000",
    high: "0.06100000",
    low: "0.04900000",
    close: "0.06000000",
    volume: "560.00000000",
    raw_payload: { fixture: true }
  }
] as const;

export const p1FundingRates = [
  {
    source: "binance_fixture",
    symbol: "BTCUSDT",
    funding_time: "2026-06-19T00:00:00.000Z",
    funding_rate: "0.00010000",
    mark_price: "65000.00000000",
    raw_payload: { fixture: true }
  }
] as const;

export const p1LedgerEvents = [
  {
    event_id: "evt_flow_001",
    event_type: "capital_flow",
    exchange_account_id: p1FixtureIds.exchangeAccountId,
    strategy_id: p1FixtureIds.strategyId,
    strategy_version: p1FixtureIds.strategyVersion,
    snapshot_id: null,
    event_time: "2026-06-19T00:01:00.000Z",
    source: "fixture",
    external_id: "fixture_flow_001",
    idempotency_key: "fixture:flow:001",
    raw_payload: { fixture: true }
  },
  {
    event_id: "evt_trade_001",
    event_type: "trade_fill",
    exchange_account_id: p1FixtureIds.exchangeAccountId,
    strategy_id: p1FixtureIds.strategyId,
    strategy_version: p1FixtureIds.strategyVersion,
    snapshot_id: p1FixtureIds.snapshotId,
    event_time: "2026-06-19T00:05:00.000Z",
    source: "fixture",
    external_id: "fixture_trade_001",
    idempotency_key: "fixture:trade:001",
    raw_payload: { fixture: true }
  }
] as const;

export const p1TradeFills = [
  {
    trade_id: "trade_2026_06_19_0001",
    ledger_event_id: "evt_trade_001",
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
    time: "2026-06-19T00:05:00.000Z",
    external_trade_id: "fixture_trade_001",
    raw_payload: { fixture: true }
  }
] as const;

export const p1CapitalFlows = [
  {
    event_id: "flow_2026_06_19_0001",
    ledger_event_id: "evt_flow_001",
    exchange_account_id: p1FixtureIds.exchangeAccountId,
    strategy_id: p1FixtureIds.strategyId,
    flow_type: "transfer_in",
    asset: "USDT",
    amount: "10000.00000000",
    event_time: "2026-06-19T00:01:00.000Z",
    source_account: "external_wallet",
    target_account: p1FixtureIds.exchangeAccountId,
    external_id: "fixture_flow_001",
    raw_payload: { fixture: true }
  }
] as const;

export const expectedActiveSignalSet = {
  snapshot_id: p1FixtureIds.snapshotId,
  as_of: p1FixtureIds.evaluatedAt,
  data_health: "complete",
  signals: [
    {
      signal_id: "risk_regime",
      signal_version: "v1",
      lifecycle_state: "enabled",
      value: "risk_on",
      raw_value: "btc_close_change=2000.00000000",
      evaluated_at: p1FixtureIds.evaluatedAt,
      reason_codes: ["btc_close_above_previous"]
    },
    {
      signal_id: "core_tilt",
      signal_version: "v1",
      lifecycle_state: "enabled",
      value: "eth_outperforming",
      raw_value: "ethbtc_close_change=0.01000000",
      evaluated_at: p1FixtureIds.evaluatedAt,
      reason_codes: ["ethbtc_close_above_previous"]
    },
    {
      signal_id: "funding_sentiment",
      signal_version: "v1",
      lifecycle_state: "enabled",
      value: "neutral",
      raw_value: "0.00010000",
      evaluated_at: p1FixtureIds.evaluatedAt,
      reason_codes: ["funding_rate_neutral"]
    }
  ]
} satisfies ActiveSignalSet;

export const expectedLedgerPositionView = {
  strategy_id: p1FixtureIds.strategyId,
  strategy_version: p1FixtureIds.strategyVersion,
  as_of: "2026-06-19T00:05:00.000Z",
  assets: [
    {
      asset: "BTC",
      free_qty: "0.10000000",
      locked_qty: "0.00000000",
      total_qty: "0.10000000",
      cost_basis_quote: "6506.50000000"
    },
    {
      asset: "USDT",
      free_qty: "3493.50000000",
      locked_qty: "0.00000000",
      total_qty: "3493.50000000",
      cost_basis_quote: "0.00000000"
    }
  ]
} satisfies LedgerPositionView;

export const expectedPlannedAction = {
  action_id: "act_snap_2026_06_19_0001",
  strategy_id: p1FixtureIds.strategyId,
  strategy_version: p1FixtureIds.strategyVersion,
  snapshot_id: p1FixtureIds.snapshotId,
  action_type: "hold",
  target_allocation_band_ref: "core_v1_risk_on",
  reason_codes: [
    "btc_close_above_previous",
    "ethbtc_close_above_previous",
    "funding_rate_neutral",
    "position_within_fixture_band"
  ],
  created_at: p1FixtureIds.evaluatedAt,
  status: "draft"
} satisfies PlannedAction;

export const expectedReviewDraft = {
  review_id: "review_core_allocation_lt_v1_2026-06-19",
  strategy_id: p1FixtureIds.strategyId,
  strategy_version: p1FixtureIds.strategyVersion,
  period_start: "2026-06-19T00:00:00.000Z",
  period_end: "2026-06-20T00:00:00.000Z",
  snapshot_refs: [],
  sections: [
    {
      key: "market",
      title: "Market",
      body: "Risk regime risk_on from snapshot snap_2026_06_19_0001."
    },
    {
      key: "ledger",
      title: "Ledger",
      body: "Position contains 2 assets and 1 trade views."
    },
    {
      key: "action",
      title: "Action",
      body: "Planned action hold remains draft."
    }
  ],
  status: "draft"
} satisfies ReviewDraft;
