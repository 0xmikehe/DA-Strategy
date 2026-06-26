import type { PrismaClient } from "@prisma/client";
import { addDecimal } from "./decimal";
import type { LedgerReplayEvent, LedgerReplayInputs, ReportedBalanceSnapshot } from "./types";

export type ReadLedgerReplayInputsOptions = {
  prismaClient: PrismaClient;
  asOf?: string;
};

const sourceKindOrder: Record<LedgerReplayEvent["kind"], number> = {
  capital_flow: 10,
  trade_fill: 20,
  external_trade: 30,
  attribution: 40,
  reversal: 50
};

export async function readLedgerReplayInputs(options: ReadLedgerReplayInputsOptions): Promise<LedgerReplayInputs> {
  const occurredAtFilter = options.asOf ? { lte: new Date(options.asOf) } : undefined;
  const [tradeFills, capitalFlows, externalTrades, attributionRecords, reversals, balanceSnapshots] = await Promise.all([
    options.prismaClient.exchangeTradeFill.findMany({ where: { occurredAt: occurredAtFilter } }),
    options.prismaClient.capitalFlowEvent.findMany({ where: { occurredAt: occurredAtFilter } }),
    options.prismaClient.externalTrade.findMany({ where: { occurredAt: occurredAtFilter } }),
    options.prismaClient.attributionRecord.findMany({ where: { occurredAt: occurredAtFilter } }),
    options.prismaClient.ledgerReversal.findMany({ where: { occurredAt: occurredAtFilter } }),
    options.prismaClient.accountBalanceSnapshot.findMany({ where: { occurredAt: occurredAtFilter } })
  ]);

  const events: LedgerReplayEvent[] = [
    ...tradeFills.map((row) => ({
      kind: "trade_fill" as const,
      idempotencyKey: row.idempotencyKey,
      naturalKey: row.naturalKey,
      occurredAt: row.occurredAt.toISOString(),
      accountId: requiredString(row.payload, "exchange_account_id"),
      strategyId: optionalString(row.payload, "strategy_id"),
      strategyVersion: optionalString(row.payload, "strategy_version"),
      symbol: requiredString(row.payload, "symbol"),
      side: requiredSide(row.payload),
      baseAsset: requiredString(row.payload, "base_asset"),
      quoteAsset: requiredString(row.payload, "quote_asset"),
      qty: requiredString(row.payload, "qty"),
      quoteQty: requiredString(row.payload, "quote_qty"),
      commission: requiredString(row.payload, "commission"),
      commissionAsset: requiredString(row.payload, "commission_asset")
    })),
    ...capitalFlows.map((row) => ({
      kind: "capital_flow" as const,
      idempotencyKey: row.idempotencyKey,
      naturalKey: row.naturalKey,
      occurredAt: row.occurredAt.toISOString(),
      accountId: requiredString(row.payload, "exchange_account_id"),
      asset: requiredString(row.payload, "asset"),
      flowType: requiredString(row.payload, "flow_type"),
      amount: requiredString(row.payload, "amount")
    })),
    ...externalTrades.map((row) => ({
      kind: "external_trade" as const,
      idempotencyKey: row.idempotencyKey,
      naturalKey: row.naturalKey,
      occurredAt: row.occurredAt.toISOString(),
      accountId: requiredString(row.payload, "exchange_account_id"),
      asset: requiredString(row.payload, "asset"),
      side: requiredSide(row.payload),
      amount: requiredString(row.payload, "amount"),
      strategyId: optionalString(row.payload, "strategy_id"),
      strategyVersion: optionalString(row.payload, "strategy_version")
    })),
    ...attributionRecords.map((row) => ({
      kind: "attribution" as const,
      idempotencyKey: row.idempotencyKey,
      naturalKey: row.naturalKey,
      occurredAt: row.occurredAt.toISOString(),
      targetIdempotencyKey: optionalString(row.payload, "target_idempotency_key"),
      assignmentKind: optionalString(row.payload, "assignment_kind"),
      strategyId: optionalString(row.payload, "strategy_id"),
      strategyVersion: optionalString(row.payload, "strategy_version")
    })),
    ...reversals.map((row) => ({
      kind: "reversal" as const,
      idempotencyKey: row.idempotencyKey,
      naturalKey: row.naturalKey,
      occurredAt: row.occurredAt.toISOString(),
      targetFactKind: row.targetFactKind,
      targetFactIdempotencyKey: row.targetFactIdempotencyKey
    }))
  ].sort(compareEvents);

  return {
    events,
    reportedSnapshots: balanceSnapshots.map(mapReportedSnapshot)
  };
}

function mapReportedSnapshot(row: Awaited<ReturnType<PrismaClient["accountBalanceSnapshot"]["findMany"]>>[number]): ReportedBalanceSnapshot {
  const free = requiredString(row.payload, "free");
  const locked = requiredString(row.payload, "locked");

  return {
    accountId: requiredString(row.payload, "exchange_account_id"),
    asset: requiredString(row.payload, "asset"),
    reportedQty: addDecimal(free, locked),
    snapshotRef: row.naturalKey,
    snapshotTime: requiredString(row.payload, "snapshot_time"),
    sourceMode: row.sourceMode
  };
}

function compareEvents(left: LedgerReplayEvent, right: LedgerReplayEvent) {
  return (
    left.occurredAt.localeCompare(right.occurredAt) ||
    sourceKindOrder[left.kind] - sourceKindOrder[right.kind] ||
    left.idempotencyKey.localeCompare(right.idempotencyKey)
  );
}

function requiredSide(payload: unknown): "BUY" | "SELL" {
  const side = requiredString(payload, "side").toUpperCase();
  if (side !== "BUY" && side !== "SELL") {
    throw new Error(`Unsupported replay side ${side}`);
  }
  return side;
}

function requiredString(payload: unknown, key: string): string {
  const value = payloadValue(payload, key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Replay payload field ${key} must be a string`);
  }
  return value;
}

function optionalString(payload: unknown, key: string): string | undefined {
  const value = payloadValue(payload, key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function payloadValue(payload: unknown, key: string): unknown {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>)[key] : undefined;
}
