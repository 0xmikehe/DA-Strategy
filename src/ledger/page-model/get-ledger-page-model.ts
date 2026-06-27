import type { LedgerDataSourceMode, LedgerFactKind } from "@/ledger/ingest";
import { getPendingAttributionItems } from "@/ledger/manual/pending-attribution";
import { addDecimal } from "@/ledger/replay/decimal";
import { readLedgerReplayInputs } from "@/ledger/replay/event-reader";
import { replayLedgerFacts } from "@/ledger/replay/replay-engine";
import type { LedgerReplayOutput } from "@/ledger/replay/types";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  freshnessLabel,
  reconciliationStatusLabel,
  reconciliationTone,
  signedDecimal
} from "./formatters";
import type {
  LedgerPageCurrentPositions,
  LedgerPageFlowRow,
  LedgerPageFreshness,
  LedgerPageModel,
  LedgerPagePendingAttributionItem,
  LedgerPagePortfolioAssetRow,
  LedgerPagePortfolioSummary,
  LedgerPagePositionRow,
  LedgerPageReconciliationRow,
  LedgerPageScopeOption,
  LedgerPageSelectedScope,
  LedgerPageSourceSummaryRow
} from "./types";
import { applyTrackedValuation, summarizeValuedPositions } from "./valuation";

export type GetLedgerPageModelOptions = {
  prismaClient?: PrismaClient;
  now?: Date;
  selectedScopeId?: string;
};

const staleAfterMs = 24 * 60 * 60 * 1000;
const factKinds: LedgerFactKind[] = [
  "exchange_trade_fill",
  "exchange_order",
  "capital_flow_event",
  "external_trade",
  "attribution_record",
  "reversal",
  "account_balance_snapshot"
];

export async function getLedgerPageModel(options: GetLedgerPageModelOptions = {}): Promise<LedgerPageModel> {
  const prismaClient = options.prismaClient ?? prisma;
  const now = options.now ?? new Date();
  const [batches, reconciliationRows, pendingItems, flows, replayInputs] = await Promise.all([
    prismaClient.ledgerIngestBatch.findMany({
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }]
    }),
    prismaClient.reconciliationResult.findMany({
      orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
      take: 12
    }),
    getPendingAttributionItems({ prismaClient }),
    readFlowRows(prismaClient),
    readLedgerReplayInputs({ prismaClient })
  ]);

  const sourceSummary = summarizeSources(batches);
  const replay = replayLedgerFacts(replayInputs.events);
  const allCurrentPositions = currentPositionsFromReplay(replay, replayInputs.events.length, reconciliationRows);
  const allReconciliationRows = reconciliationRows.map(reconciliationRowFromDb);
  const allPendingItems = pendingItems.map((item) => ({
    factKind: item.factKind,
    idempotencyKey: item.idempotencyKey,
    sourceMode: item.sourceMode,
    accountId: item.accountId,
    asset: item.asset,
    quantity: item.quantity,
    occurredAt: item.occurredAt,
    suggestedReason: item.suggestedReason,
    attributionState: item.attributionState
  }) satisfies LedgerPagePendingAttributionItem);
  const allFlowRows = flows.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 80);
  const portfolioSummary = buildPortfolioSummary(
    allCurrentPositions.accountRows,
    allReconciliationRows,
    allPendingItems,
    allFlowRows
  );
  const selectedScope = selectScope(options.selectedScopeId, portfolioSummary.scopeOptions);
  const currentPositions = scopeCurrentPositions(selectedScope, allCurrentPositions);

  return {
    generatedAt: now.toISOString(),
    selectedScope,
    freshness: freshnessFromBatches(batches, now),
    sourceSummary,
    portfolioSummary,
    currentPositions,
    reconciliation: {
      rows: scopeByAccount(selectedScope, allReconciliationRows)
    },
    pendingAttribution: {
      items: scopeByAccount(selectedScope, allPendingItems)
    },
    flows: {
      rows: scopeByOptionalAccount(selectedScope, allFlowRows)
    },
    externalTradeFormOptions: {
      accounts: unique(flows.map((row) => row.accountId).filter((value): value is string => Boolean(value))),
      assets: unique(flows.map((row) => row.asset).filter((value): value is string => Boolean(value))),
      defaultQuoteAsset: "USDT",
      strategyOptions: [{ strategyId: "core_allocation_lt", strategyVersion: "v1", label: "core_allocation_lt@v1" }]
    },
    bindingHealth: {
      state: "WARN",
      label: "binding/key health summary unavailable",
      safeReason: "P2-3a binding baseline is not enabled in this offline page loop."
    },
    capabilities: {
      manualSync: false,
      requestReconciliation: true,
      attribution: true,
      reversal: true,
      externalTradeEntry: true,
      liveRuntime: false
    }
  };
}

function reconciliationRowFromDb(
  row: Awaited<ReturnType<PrismaClient["reconciliationResult"]["findMany"]>>[number]
): LedgerPageReconciliationRow {
  return {
    runId: row.runId,
    accountId: row.accountId,
    asset: row.asset,
    computedQty: row.computedQty,
    reportedQty: row.reportedQty ?? undefined,
    diffQty: row.diffQty,
    signedDiff: signedDecimal(row.diffQty),
    thresholdQty: row.thresholdQty,
    status: row.status,
    label: reconciliationStatusLabel(row.status),
    tone: reconciliationTone(row.status),
    checkedAt: row.checkedAt.toISOString(),
    snapshotRef: row.snapshotRef ?? undefined,
    note: row.note ?? undefined
  };
}

function currentPositionsFromReplay(
  replay: LedgerReplayOutput,
  eventCount: number,
  reconciliationRows: Awaited<ReturnType<PrismaClient["reconciliationResult"]["findMany"]>>
): LedgerPageCurrentPositions {
  return {
    eventCount,
    accountRows: applyTrackedValuation(rowsFromNestedBalances("account", replay.accountBalances, reconciliationRows)),
    strategyRows: applyTrackedValuation(rowsFromNestedBalances("strategy", replay.strategyPositions)),
    unassignedRows: applyTrackedValuation(rowsFromNestedBalances("unassigned", replay.unassigned)),
    diagnostics: replay.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
      factIdempotencyKey: diagnostic.factIdempotencyKey
    }))
  };
}

function buildPortfolioSummary(
  accountRows: LedgerPagePositionRow[],
  reconciliationRows: LedgerPageReconciliationRow[],
  pendingItems: LedgerPagePendingAttributionItem[],
  flowRows: LedgerPageFlowRow[]
): LedgerPagePortfolioSummary {
  const assetRows = aggregateAssetRows(accountRows);
  const summaryValuation = summarizeValuedPositions(assetRows.map((row) => ({
    scopeType: "account",
    scopeId: "all",
    asset: row.asset,
    quantity: row.quantity,
    signedQuantity: row.signedQuantity,
    valuationStatus: row.valuationStatus,
    priceUsd: row.priceUsd,
    estimatedValueUsd: row.estimatedValueUsd
  })));
  const accountIds = unique([
    ...accountRows.map((row) => row.scopeId),
    ...reconciliationRows.map((row) => row.accountId),
    ...pendingItems.map((item) => item.accountId),
    ...flowRows.map((row) => row.accountId).filter((value): value is string => Boolean(value))
  ]);
  const accountOptions = accountIds.map((accountId) =>
    accountScopeOption(accountId, accountRows, reconciliationRows, pendingItems, flowRows)
  );
  const reconciliationIssueCount = reconciliationRows.filter((row) => row.tone !== "good").length;
  const latestActivityAt = latestFlowAt(flowRows);
  const walletCount = accountOptions.filter((option) => option.role === "external_wallet").length;

  return {
    estimatedValueUsd: summaryValuation.estimatedValueUsd,
    accountCount: accountOptions.length - walletCount,
    walletCount,
    assetCount: assetRows.length,
    pricedAssetCount: summaryValuation.pricedAssetCount,
    unpricedAssetCount: summaryValuation.unpricedAssetCount,
    reconciliationIssueCount,
    pendingAttributionCount: pendingItems.length,
    latestActivityAt,
    assetRows,
    scopeOptions: [
      {
        kind: "all",
        scopeId: "all",
        label: "全部账户总览",
        assetCount: assetRows.length,
        pricedAssetCount: summaryValuation.pricedAssetCount,
        unpricedAssetCount: summaryValuation.unpricedAssetCount,
        estimatedValueUsd: summaryValuation.estimatedValueUsd,
        reconciliationIssueCount,
        pendingAttributionCount: pendingItems.length,
        latestActivityAt
      },
      ...accountOptions
    ],
    recentFlowRows: flowRows.slice(0, 5)
  };
}

function aggregateAssetRows(rows: LedgerPagePositionRow[]): LedgerPagePortfolioAssetRow[] {
  const quantityByAsset = new Map<string, string>();

  for (const row of rows) {
    quantityByAsset.set(row.asset, addDecimal(quantityByAsset.get(row.asset) ?? "0.00000000", row.quantity));
  }

  return applyTrackedValuation(
    [...quantityByAsset.entries()].map(([asset, quantity]) => ({
      scopeType: "account",
      scopeId: "all",
      asset,
      quantity,
      signedQuantity: signedDecimal(quantity)
    }))
  ).map((row) => ({
    asset: row.asset,
    quantity: row.quantity,
    signedQuantity: row.signedQuantity,
    valuationStatus: row.valuationStatus ?? "unpriced",
    priceUsd: row.priceUsd,
    estimatedValueUsd: row.estimatedValueUsd
  }));
}

function accountScopeOption(
  accountId: string,
  accountRows: LedgerPagePositionRow[],
  reconciliationRows: LedgerPageReconciliationRow[],
  pendingItems: LedgerPagePendingAttributionItem[],
  flowRows: LedgerPageFlowRow[]
): LedgerPageScopeOption {
  const rows = accountRows.filter((row) => row.scopeId === accountId);
  const valuation = summarizeValuedPositions(rows);
  const accountFlows = flowRows.filter((row) => row.accountId === accountId);

  return {
    kind: "account",
    scopeId: accountId,
    label: accountId,
    accountId,
    role: inferAccountRole(accountId),
    assetCount: new Set(rows.map((row) => row.asset)).size,
    pricedAssetCount: valuation.pricedAssetCount,
    unpricedAssetCount: valuation.unpricedAssetCount,
    estimatedValueUsd: valuation.estimatedValueUsd,
    reconciliationIssueCount: reconciliationRows.filter((row) => row.accountId === accountId && row.tone !== "good").length,
    pendingAttributionCount: pendingItems.filter((item) => item.accountId === accountId).length,
    latestActivityAt: latestFlowAt(accountFlows)
  };
}

function selectScope(selectedScopeId: string | undefined, options: LedgerPageScopeOption[]): LedgerPageSelectedScope {
  const option = selectedScopeId && selectedScopeId !== "all"
    ? options.find((candidate) => candidate.scopeId === selectedScopeId)
    : options[0];
  const selected = option ?? options[0];

  if (selected.kind === "account") {
    return {
      kind: "account",
      scopeId: selected.scopeId,
      label: selected.label,
      accountId: selected.accountId,
      role: selected.role
    };
  }

  return {
    kind: "all",
    scopeId: "all",
    label: "全部账户总览"
  };
}

function scopeCurrentPositions(
  selectedScope: LedgerPageSelectedScope,
  currentPositions: LedgerPageCurrentPositions
): LedgerPageCurrentPositions {
  if (selectedScope.kind === "all") {
    return {
      eventCount: currentPositions.eventCount,
      accountRows: [],
      strategyRows: [],
      unassignedRows: [],
      diagnostics: currentPositions.diagnostics
    };
  }

  return {
    eventCount: currentPositions.eventCount,
    accountRows: currentPositions.accountRows.filter((row) => row.scopeId === selectedScope.accountId),
    strategyRows: currentPositions.strategyRows,
    unassignedRows: [],
    diagnostics: currentPositions.diagnostics
  };
}

function scopeByAccount<T extends { accountId: string }>(selectedScope: LedgerPageSelectedScope, rows: T[]): T[] {
  if (selectedScope.kind === "all") {
    return [];
  }
  return rows.filter((row) => row.accountId === selectedScope.accountId);
}

function scopeByOptionalAccount<T extends { accountId?: string }>(selectedScope: LedgerPageSelectedScope, rows: T[]): T[] {
  if (selectedScope.kind === "all") {
    return [];
  }
  return rows.filter((row) => row.accountId === selectedScope.accountId);
}

function latestFlowAt(flowRows: LedgerPageFlowRow[]): string | undefined {
  return flowRows.reduce<string | undefined>((latest, row) => {
    if (!latest || row.occurredAt > latest) {
      return row.occurredAt;
    }
    return latest;
  }, undefined);
}

function inferAccountRole(accountId: string): LedgerPageScopeOption["role"] {
  const normalized = accountId.toLowerCase();
  if (normalized.includes("master")) {
    return "master";
  }
  if (normalized.includes("external") || normalized.includes("wallet")) {
    return "external_wallet";
  }
  if (normalized.includes("sub") || normalized.includes("spot")) {
    return "sub_account";
  }
  return "unknown";
}

function rowsFromNestedBalances(
  scopeType: LedgerPagePositionRow["scopeType"],
  balances: Record<string, Record<string, string>>,
  reconciliationRows: Awaited<ReturnType<PrismaClient["reconciliationResult"]["findMany"]>> = []
): LedgerPagePositionRow[] {
  const reconciliationByAccountAsset = new Map(
    reconciliationRows.map((row) => [`${row.accountId}:${row.asset}`, row])
  );

  return Object.entries(balances)
    .flatMap(([scopeId, assetBalances]) =>
      Object.entries(assetBalances).map(([asset, quantity]) => {
        const reconciliation = scopeType === "account" ? reconciliationByAccountAsset.get(`${scopeId}:${asset}`) : undefined;
        return {
          scopeType,
          scopeId,
          asset,
          quantity,
          signedQuantity: signedDecimal(quantity),
          reconciliationStatus: reconciliation?.status,
          reconciliationLabel: reconciliation ? reconciliationStatusLabel(reconciliation.status) : undefined,
          reconciliationTone: reconciliation ? reconciliationTone(reconciliation.status) : undefined
        } satisfies LedgerPagePositionRow;
      })
    )
    .sort(comparePositionRows);
}

function comparePositionRows(left: LedgerPagePositionRow, right: LedgerPagePositionRow): number {
  return (
    left.scopeId.localeCompare(right.scopeId) ||
    left.asset.localeCompare(right.asset)
  );
}

function freshnessFromBatches(
  batches: Awaited<ReturnType<PrismaClient["ledgerIngestBatch"]["findMany"]>>,
  now: Date
): LedgerPageFreshness {
  const latest = batches[0];
  if (!latest) {
    return {
      state: "empty",
      label: freshnessLabel("empty")
    };
  }

  const ageMs = now.getTime() - latest.requestedAt.getTime();
  const state = ageMs > staleAfterMs ? "stale" : "ok";
  return {
    state,
    label: freshnessLabel(state),
    latestAt: latest.requestedAt.toISOString()
  };
}

function summarizeSources(
  batches: Awaited<ReturnType<PrismaClient["ledgerIngestBatch"]["findMany"]>>
): { totalFacts: number; modes: LedgerPageSourceSummaryRow[] } {
  const byMode = new Map<LedgerDataSourceMode, LedgerPageSourceSummaryRow>();

  for (const batch of batches) {
    const current =
      byMode.get(batch.sourceMode) ??
      ({
        sourceMode: batch.sourceMode,
        batchCount: 0,
        factCount: 0,
        latestRequestedAt: undefined
      } satisfies LedgerPageSourceSummaryRow);

    current.batchCount += 1;
    current.factCount += insertedCount(batch.resultSummary);
    if (!current.latestRequestedAt || batch.requestedAt.toISOString() > current.latestRequestedAt) {
      current.latestRequestedAt = batch.requestedAt.toISOString();
    }
    byMode.set(batch.sourceMode, current);
  }

  const modes = [...byMode.values()].sort((left, right) => left.sourceMode.localeCompare(right.sourceMode));
  return {
    totalFacts: modes.reduce((sum, row) => sum + row.factCount, 0),
    modes
  };
}

function insertedCount(resultSummary: Prisma.JsonValue | null): number {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return 0;
  }

  const inserted = (resultSummary as Record<string, unknown>).inserted;
  if (!inserted || typeof inserted !== "object" || Array.isArray(inserted)) {
    return 0;
  }

  return factKinds.reduce((sum, kind) => {
    const value = (inserted as Record<string, unknown>)[kind];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

async function readFlowRows(prismaClient: PrismaClient): Promise<LedgerPageFlowRow[]> {
  const [
    tradeFills,
    orders,
    capitalFlows,
    externalTrades,
    attributionRecords,
    reversals,
    balanceSnapshots
  ] = await Promise.all([
    prismaClient.exchangeTradeFill.findMany({ orderBy: [{ occurredAt: "desc" }], take: 40 }),
    prismaClient.exchangeOrder.findMany({ orderBy: [{ occurredAt: "desc" }], take: 20 }),
    prismaClient.capitalFlowEvent.findMany({ orderBy: [{ occurredAt: "desc" }], take: 40 }),
    prismaClient.externalTrade.findMany({ orderBy: [{ occurredAt: "desc" }], take: 40 }),
    prismaClient.attributionRecord.findMany({ orderBy: [{ occurredAt: "desc" }], take: 30 }),
    prismaClient.ledgerReversal.findMany({ orderBy: [{ occurredAt: "desc" }], take: 20 }),
    prismaClient.accountBalanceSnapshot.findMany({ orderBy: [{ occurredAt: "desc" }], take: 20 })
  ]);

  return [
    ...tradeFills.map((row) => factRow("exchange_trade_fill", row, tradeFillQuantity(row.payload), optionalString(row.payload, "side"))),
    ...orders.map((row) => factRow("exchange_order", row, optionalString(row.payload, "qty"), optionalString(row.payload, "side"))),
    ...capitalFlows.map((row) => factRow("capital_flow_event", row, capitalFlowQuantity(row.payload), optionalString(row.payload, "flow_type"))),
    ...externalTrades.map((row) => factRow("external_trade", row, externalTradeQuantity(row.payload), optionalString(row.payload, "side"))),
    ...attributionRecords.map((row) => factRow("attribution_record", row, undefined, optionalString(row.payload, "assignment_kind"))),
    ...reversals.map((row) => factRow("reversal", row, undefined, row.reasonCode)),
    ...balanceSnapshots.map((row) => factRow("account_balance_snapshot", row, balanceSnapshotQuantity(row.payload), optionalString(row.payload, "reported_scope")))
  ];
}

function factRow(
  factKind: LedgerFactKind,
  row: {
    idempotencyKey: string;
    naturalKey: string;
    sourceMode: LedgerDataSourceMode;
    origin: Prisma.JsonValue;
    occurredAt: Date;
    exchangeAccountId: string | null;
    asset: string | null;
    strategyId: string | null;
    snapshotId: string | null;
  },
  quantity: string | undefined,
  side: string | undefined
): LedgerPageFlowRow {
  return {
    factKind,
    idempotencyKey: row.idempotencyKey,
    naturalKey: row.naturalKey,
    sourceMode: row.sourceMode,
    originKind: originKind(row.origin),
    accountId: row.exchangeAccountId ?? undefined,
    asset: row.asset ?? undefined,
    quantity,
    signedQuantity: quantity ? signedDecimal(quantity) : undefined,
    side,
    strategyId: row.strategyId ?? undefined,
    snapshotId: row.snapshotId ?? undefined,
    occurredAt: row.occurredAt.toISOString()
  };
}

function tradeFillQuantity(payload: Prisma.JsonValue): string | undefined {
  const qty = optionalString(payload, "qty");
  if (!qty) {
    return undefined;
  }

  return optionalString(payload, "side") === "SELL" ? `-${qty}` : qty;
}

function capitalFlowQuantity(payload: Prisma.JsonValue): string | undefined {
  const amount = optionalString(payload, "amount");
  if (!amount) {
    return undefined;
  }

  const flowType = optionalString(payload, "flow_type");
  return flowType === "withdrawal" || flowType === "transfer_out" ? `-${amount}` : amount;
}

function externalTradeQuantity(payload: Prisma.JsonValue): string | undefined {
  const amount = optionalString(payload, "amount");
  if (!amount) {
    return undefined;
  }

  return optionalString(payload, "side") === "SELL" ? `-${amount}` : amount;
}

function balanceSnapshotQuantity(payload: Prisma.JsonValue): string | undefined {
  const free = optionalString(payload, "free");
  const locked = optionalString(payload, "locked");
  if (free && locked === "0.00000000") {
    return free;
  }
  return free;
}

function originKind(origin: Prisma.JsonValue): string {
  if (origin && typeof origin === "object" && !Array.isArray(origin)) {
    const kind = (origin as Record<string, unknown>).kind;
    if (typeof kind === "string") {
      return kind;
    }
  }

  return "unknown";
}

function optionalString(payload: Prisma.JsonValue, key: string): string | undefined {
  const value = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)[key]
    : undefined;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
