export type DecimalString = string;
export type IsoDateTimeString = string;
export type StableId = string;

export type SignalLifecycleState =
  | "shadow"
  | "watching"
  | "enabled"
  | "disabled"
  | "retired";

export type BindingState = "active" | "warn" | "blocked";
export type StrategyVersionStatus = "draft" | "active" | "superseded" | "retired";
export type PlannedActionStatus = "draft" | "confirmed" | "dismissed" | "executed_manually";
export type DataHealth = "complete" | "partial" | "stale" | "missing";
export type AssetRole = "stable" | "core" | "satellite" | "fee_asset";
export type AssetStatus = "active" | "disabled" | "retired";

export type ActiveSignal = {
  signal_id: StableId;
  signal_version: string;
  lifecycle_state: Extract<SignalLifecycleState, "enabled">;
  value: string;
  raw_value: string;
  evaluated_at: IsoDateTimeString;
  reason_codes: string[];
};

export type ActiveSignalSet = {
  snapshot_id: StableId;
  as_of: IsoDateTimeString;
  signals: ActiveSignal[];
  data_health: DataHealth;
};

export type SignalSnapshotRef = {
  snapshot_id: StableId;
  created_at: IsoDateTimeString;
  schema_version: string;
  content_hash: string;
};

export type LedgerAssetPosition = {
  asset: string;
  free_qty: DecimalString;
  locked_qty: DecimalString;
  total_qty: DecimalString;
  cost_basis_quote: DecimalString;
};

export type LedgerPositionView = {
  strategy_id: StableId;
  strategy_version: string;
  as_of: IsoDateTimeString;
  assets: LedgerAssetPosition[];
};

export type LedgerTradeView = {
  trade_id: StableId;
  exchange_account_id: StableId;
  strategy_id: StableId;
  strategy_version: string;
  snapshot_id: StableId;
  symbol: string;
  side: "buy" | "sell";
  price: DecimalString;
  qty: DecimalString;
  commission_asset: string;
  commission_qty: DecimalString;
  time: IsoDateTimeString;
};

export type CapitalFlowView = {
  event_id: StableId;
  strategy_id?: StableId;
  flow_type: "deposit" | "withdrawal" | "transfer_in" | "transfer_out";
  asset: string;
  amount: DecimalString;
  event_time: IsoDateTimeString;
  source_account?: StableId;
  target_account?: StableId;
};

export type AccountBindingStatus = {
  strategy_id: StableId;
  exchange_account_id: StableId;
  binding_state: BindingState;
  credential_health: "ok" | "warn" | "blocked";
  last_checked_at: IsoDateTimeString;
  blocking_reasons: string[];
  key_ref?: string;
};

export type StrategyBindingRef = {
  strategy_id: StableId;
  strategy_version: string;
  exchange_account_id: StableId;
  binding_state: BindingState;
  effective_from: IsoDateTimeString;
  effective_to?: IsoDateTimeString;
};

export type StrategyVersionRef = {
  strategy_id: StableId;
  strategy_version: string;
  effective_from: IsoDateTimeString;
  effective_to?: IsoDateTimeString;
  status: StrategyVersionStatus;
};

export type AssetPoolItem = {
  strategy_id: StableId;
  strategy_version: string;
  asset: string;
  role: AssetRole;
  status: AssetStatus;
  effective_from: IsoDateTimeString;
  effective_to?: IsoDateTimeString;
};

export type SyncSymbolSet = {
  strategy_id: StableId;
  strategy_version: string;
  spot_symbols: string[];
  derived_from_assets: string[];
  effective_from: IsoDateTimeString;
};

export type PlannedAction = {
  action_id: StableId;
  strategy_id: StableId;
  strategy_version: string;
  snapshot_id: StableId;
  action_type: "hold" | "rebalance" | "review" | "manual_check";
  target_allocation_band_ref: StableId;
  reason_codes: string[];
  created_at: IsoDateTimeString;
  status: PlannedActionStatus;
};

export type ReviewDraft = {
  review_id: StableId;
  strategy_id: StableId;
  strategy_version: string;
  period_start: IsoDateTimeString;
  period_end: IsoDateTimeString;
  snapshot_refs: SignalSnapshotRef[];
  sections: Array<{
    key: string;
    title: string;
    body: string;
  }>;
  status: "draft" | "confirmed" | "superseded";
};
