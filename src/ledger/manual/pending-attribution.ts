import type { LedgerDataSourceMode } from "@/ledger/ingest";
import type { Prisma, PrismaClient } from "@prisma/client";

export type PendingAttributionQueryOptions = {
  prismaClient: PrismaClient;
};

export type PendingAttributionItem = {
  factKind: "external_trade";
  id: string;
  idempotencyKey: string;
  naturalKey: string;
  sourceMode: LedgerDataSourceMode;
  origin: Prisma.JsonValue;
  occurredAt: string;
  accountId: string;
  asset: string;
  quantity: string;
  attributionState: "pending";
  suggestedReason: "missing_attribution";
};

export async function getPendingAttributionItems(
  options: PendingAttributionQueryOptions
): Promise<PendingAttributionItem[]> {
  const [externalTrades, attributionRecords, reversals] = await Promise.all([
    options.prismaClient.externalTrade.findMany({
      orderBy: [{ occurredAt: "asc" }, { idempotencyKey: "asc" }]
    }),
    options.prismaClient.attributionRecord.findMany({
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { idempotencyKey: "asc" }]
    }),
    options.prismaClient.ledgerReversal.findMany({
      where: { targetFactKind: { in: ["external_trade", "attribution_record"] } },
      select: { targetFactKind: true, targetFactIdempotencyKey: true }
    })
  ]);

  const reversedAttributions = new Set(
    reversals
      .filter((row) => row.targetFactKind === "attribution_record")
      .map((row) => row.targetFactIdempotencyKey)
  );
  const latestAttributionByTarget = new Map<string, Prisma.JsonValue>();
  for (const row of attributionRecords) {
    if (reversedAttributions.has(row.idempotencyKey)) {
      continue;
    }

    const targetIdempotencyKey = optionalString(row.payload, "target_idempotency_key");
    if (targetIdempotencyKey) {
      latestAttributionByTarget.set(targetIdempotencyKey, row.payload);
    }
  }

  const reversedTargets = new Set(
    reversals
      .filter((row) => row.targetFactKind === "external_trade")
      .map((row) => row.targetFactIdempotencyKey)
  );

  return externalTrades
    .filter((row) => {
      if (reversedTargets.has(row.idempotencyKey)) {
        return false;
      }

      const latestAttribution = latestAttributionByTarget.get(row.idempotencyKey);
      if (latestAttribution) {
        return isPendingAssignment(latestAttribution);
      }

      return isPendingSourceFact(row.payload);
    })
    .map((row) => ({
      factKind: "external_trade" as const,
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      naturalKey: row.naturalKey,
      sourceMode: row.sourceMode,
      origin: row.origin,
      occurredAt: row.occurredAt.toISOString(),
      accountId: requiredString(row.payload, "exchange_account_id"),
      asset: requiredString(row.payload, "asset"),
      quantity: requiredString(row.payload, "amount"),
      attributionState: "pending" as const,
      suggestedReason: "missing_attribution" as const
    }));
}

function isPendingAssignment(payload: Prisma.JsonValue): boolean {
  const assignmentKind = optionalString(payload, "assignment_kind");
  return assignmentKind !== "strategy" && assignmentKind !== "external" && assignmentKind !== "unassigned";
}

function isPendingSourceFact(payload: Prisma.JsonValue): boolean {
  const attributionStatus = optionalString(payload, "attribution_status");
  if (attributionStatus && attributionStatus !== "pending") {
    return false;
  }

  return !optionalString(payload, "strategy_id") || !optionalString(payload, "strategy_version");
}

function requiredString(payload: Prisma.JsonValue, key: string): string {
  const value = payloadValue(payload, key);

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Pending attribution payload field ${key} must be a string`);
  }

  return value;
}

function optionalString(payload: Prisma.JsonValue, key: string): string | undefined {
  const value = payloadValue(payload, key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function payloadValue(payload: Prisma.JsonValue, key: string): unknown {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)[key]
    : undefined;
}
