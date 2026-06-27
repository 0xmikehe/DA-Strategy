import type { LedgerDataSourceMode, LedgerFactKind } from "@/ledger/ingest";
import type { ReconciliationStatus } from "@/ledger/reconciliation/types";

export type LedgerPageFreshnessState = "ok" | "stale" | "fail" | "load" | "empty";

export type LedgerPageFreshness = {
  state: LedgerPageFreshnessState;
  label: string;
  latestAt?: string;
  safeReason?: string;
};

export type LedgerPageSourceSummaryRow = {
  sourceMode: LedgerDataSourceMode;
  batchCount: number;
  factCount: number;
  latestRequestedAt?: string;
};

export type LedgerPageSourceSummary = {
  totalFacts: number;
  modes: LedgerPageSourceSummaryRow[];
};

export type LedgerPageReconciliationRow = {
  runId: string;
  accountId: string;
  asset: string;
  computedQty: string;
  reportedQty?: string;
  diffQty: string;
  signedDiff: string;
  thresholdQty: string;
  status: ReconciliationStatus;
  label: string;
  tone: "good" | "warn" | "risk";
  checkedAt: string;
  snapshotRef?: string;
  note?: string;
};

export type LedgerPagePendingAttributionItem = {
  factKind: "external_trade";
  idempotencyKey: string;
  sourceMode: LedgerDataSourceMode;
  accountId: string;
  asset: string;
  quantity: string;
  occurredAt: string;
  suggestedReason: string;
  attributionState: "pending";
};

export type LedgerPagePositionRow = {
  scopeType: "account" | "strategy" | "unassigned";
  scopeId: string;
  asset: string;
  quantity: string;
  signedQuantity: string;
  valuationStatus?: "priced" | "stablecoin_peg" | "unpriced";
  priceUsd?: string;
  estimatedValueUsd?: string;
  reconciliationStatus?: ReconciliationStatus;
  reconciliationLabel?: string;
  reconciliationTone?: "good" | "warn" | "risk";
};

export type LedgerPageScopeKind = "all" | "account";
export type LedgerPageAccountRole = "master" | "sub_account" | "external_wallet" | "unknown";

export type LedgerPageSelectedScope = {
  kind: LedgerPageScopeKind;
  scopeId: string;
  label: string;
  accountId?: string;
  role?: LedgerPageAccountRole;
};

export type LedgerPagePortfolioAssetRow = {
  asset: string;
  quantity: string;
  signedQuantity: string;
  valuationStatus: "priced" | "stablecoin_peg" | "unpriced";
  priceUsd?: string;
  estimatedValueUsd?: string;
};

export type LedgerPageScopeOption = LedgerPageSelectedScope & {
  assetCount: number;
  pricedAssetCount: number;
  unpricedAssetCount: number;
  estimatedValueUsd?: string;
  reconciliationIssueCount: number;
  pendingAttributionCount: number;
  latestActivityAt?: string;
};

export type LedgerPagePortfolioSummary = {
  estimatedValueUsd?: string;
  accountCount: number;
  walletCount: number;
  assetCount: number;
  pricedAssetCount: number;
  unpricedAssetCount: number;
  reconciliationIssueCount: number;
  pendingAttributionCount: number;
  latestActivityAt?: string;
  assetRows: LedgerPagePortfolioAssetRow[];
  scopeOptions: LedgerPageScopeOption[];
  recentFlowRows: LedgerPageFlowRow[];
};

export type LedgerPageReplayDiagnostic = {
  code: string;
  message: string;
  severity?: "info" | "warn" | "error";
  factIdempotencyKey?: string;
};

export type LedgerPageCurrentPositions = {
  eventCount: number;
  accountRows: LedgerPagePositionRow[];
  strategyRows: LedgerPagePositionRow[];
  unassignedRows: LedgerPagePositionRow[];
  diagnostics: LedgerPageReplayDiagnostic[];
};

export type LedgerPageFlowRow = {
  factKind: LedgerFactKind;
  idempotencyKey: string;
  naturalKey: string;
  sourceMode: LedgerDataSourceMode;
  originKind: string;
  accountId?: string;
  asset?: string;
  quantity?: string;
  signedQuantity?: string;
  side?: string;
  strategyId?: string;
  snapshotId?: string;
  occurredAt: string;
};

export type LedgerPageExternalTradeFormOptions = {
  accounts: string[];
  assets: string[];
  defaultQuoteAsset: string;
  strategyOptions: Array<{
    strategyId: string;
    strategyVersion: string;
    label: string;
  }>;
};

export type LedgerPageBindingHealth = {
  state: "OK" | "WARN" | "BLOCK" | "EMPTY";
  label: string;
  lastCheckedAt?: string;
  safeReason: string;
};

export type LedgerPageCapabilities = {
  manualSync: boolean;
  requestReconciliation: boolean;
  attribution: boolean;
  reversal: boolean;
  externalTradeEntry: boolean;
  liveRuntime: boolean;
};

export type LedgerPageModel = {
  generatedAt: string;
  selectedScope: LedgerPageSelectedScope;
  freshness: LedgerPageFreshness;
  sourceSummary: LedgerPageSourceSummary;
  portfolioSummary: LedgerPagePortfolioSummary;
  currentPositions: LedgerPageCurrentPositions;
  reconciliation: {
    rows: LedgerPageReconciliationRow[];
  };
  pendingAttribution: {
    items: LedgerPagePendingAttributionItem[];
  };
  flows: {
    rows: LedgerPageFlowRow[];
  };
  externalTradeFormOptions: LedgerPageExternalTradeFormOptions;
  bindingHealth: LedgerPageBindingHealth;
  capabilities: LedgerPageCapabilities;
};
