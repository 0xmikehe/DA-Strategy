export type ReplayDiagnostic = {
  code: string;
  message: string;
  severity?: "info" | "warn" | "error";
  factIdempotencyKey?: string;
};

export type TradeFillReplayEvent = {
  kind: "trade_fill";
  idempotencyKey: string;
  naturalKey: string;
  occurredAt: string;
  accountId: string;
  strategyId?: string;
  strategyVersion?: string;
  symbol: string;
  side: "BUY" | "SELL";
  baseAsset: string;
  quoteAsset: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
};

export type CapitalFlowReplayEvent = {
  kind: "capital_flow";
  idempotencyKey: string;
  naturalKey: string;
  occurredAt: string;
  accountId: string;
  asset: string;
  flowType: string;
  amount: string;
};

export type ExternalTradeReplayEvent = {
  kind: "external_trade";
  idempotencyKey: string;
  naturalKey: string;
  occurredAt: string;
  accountId: string;
  asset: string;
  side: "BUY" | "SELL";
  amount: string;
  strategyId?: string;
  strategyVersion?: string;
};

export type AttributionReplayEvent = {
  kind: "attribution";
  idempotencyKey: string;
  naturalKey: string;
  occurredAt: string;
  targetIdempotencyKey?: string;
  assignmentKind?: string;
  strategyId?: string;
  strategyVersion?: string;
};

export type ReversalReplayEvent = {
  kind: "reversal";
  idempotencyKey: string;
  naturalKey: string;
  occurredAt: string;
  targetFactKind: string;
  targetFactIdempotencyKey: string;
};

export type LedgerReplayEvent =
  | TradeFillReplayEvent
  | CapitalFlowReplayEvent
  | ExternalTradeReplayEvent
  | AttributionReplayEvent
  | ReversalReplayEvent;

export type ReportedBalanceSnapshot = {
  accountId: string;
  asset: string;
  reportedQty: string;
  snapshotRef: string;
  snapshotTime: string;
  sourceMode: string;
};

export type LedgerReplayInputs = {
  events: LedgerReplayEvent[];
  reportedSnapshots: ReportedBalanceSnapshot[];
};

export type LedgerReplayOutput = {
  accountBalances: Record<string, Record<string, string>>;
  strategyPositions: Record<string, Record<string, string>>;
  lots: Record<string, unknown[]>;
  realizedPnl: Record<string, unknown>;
  unassigned: Record<string, Record<string, string>>;
  diagnostics: ReplayDiagnostic[];
};
