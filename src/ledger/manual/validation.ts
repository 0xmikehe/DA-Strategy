import type { LedgerFactDimensions, LedgerFactKind } from "@/ledger/ingest";
import type { Prisma, PrismaClient } from "@prisma/client";

export type ManualAttributionTargetFactKind = "exchange_trade_fill" | "capital_flow_event" | "external_trade";

export type ManualReversalTargetFactKind = LedgerFactKind;

export type ManualTargetReference = {
  target_fact_id?: string;
  target_idempotency_key?: string;
};

export type ManualTargetFact = {
  kind: LedgerFactKind;
  id: string;
  idempotencyKey: string;
  exchangeAccountId: string | null;
  asset: string | null;
  baseAsset: string | null;
  quoteAsset: string | null;
  strategyId: string | null;
  strategyVersion: string | null;
  payload: Prisma.JsonValue;
};

const targetFactSelect = {
  id: true,
  idempotencyKey: true,
  exchangeAccountId: true,
  asset: true,
  baseAsset: true,
  quoteAsset: true,
  strategyId: true,
  strategyVersion: true,
  payload: true
} as const;

export async function requireManualTargetFact(
  prismaClient: PrismaClient,
  kind: LedgerFactKind,
  reference: ManualTargetReference
): Promise<ManualTargetFact> {
  const target = await findManualTargetFact(prismaClient, kind, reference);

  if (!target) {
    throw new Error(`MANUAL_TARGET_NOT_FOUND:${kind}`);
  }

  return target;
}

export async function assertManualReversalTargetAvailable(
  prismaClient: PrismaClient,
  kind: LedgerFactKind,
  idempotencyKey: string
) {
  const existingReversal = await prismaClient.ledgerReversal.findUnique({
    where: {
      targetFactKind_targetFactIdempotencyKey: {
        targetFactKind: kind,
        targetFactIdempotencyKey: idempotencyKey
      }
    },
    select: { idempotencyKey: true }
  });

  if (existingReversal) {
    throw new Error(`MANUAL_TARGET_ALREADY_REVERSED:${kind}:${idempotencyKey}`);
  }
}

export function dimensionsFromTargetFact(
  target: ManualTargetFact,
  override?: Pick<LedgerFactDimensions, "strategy_id" | "strategy_version">
): LedgerFactDimensions {
  return {
    exchange_account_id: target.exchangeAccountId ?? undefined,
    asset: target.asset ?? undefined,
    base_asset: target.baseAsset ?? undefined,
    quote_asset: target.quoteAsset ?? undefined,
    strategy_id: override?.strategy_id ?? target.strategyId ?? undefined,
    strategy_version: override?.strategy_version ?? target.strategyVersion ?? undefined
  };
}

async function findManualTargetFact(
  prismaClient: PrismaClient,
  kind: LedgerFactKind,
  reference: ManualTargetReference
): Promise<ManualTargetFact | null> {
  switch (kind) {
    case "exchange_trade_fill":
      return mapTargetFact(
        kind,
        await prismaClient.exchangeTradeFill.findUnique({
          where: sourceFactWhere(reference),
          select: targetFactSelect
        })
      );
    case "exchange_order":
      return mapTargetFact(
        kind,
        await prismaClient.exchangeOrder.findUnique({
          where: sourceFactWhere(reference),
          select: targetFactSelect
        })
      );
    case "capital_flow_event":
      return mapTargetFact(
        kind,
        await prismaClient.capitalFlowEvent.findUnique({
          where: sourceFactWhere(reference),
          select: targetFactSelect
        })
      );
    case "external_trade":
      return mapTargetFact(
        kind,
        await prismaClient.externalTrade.findUnique({
          where: sourceFactWhere(reference),
          select: targetFactSelect
        })
      );
    case "attribution_record":
      return mapTargetFact(
        kind,
        await prismaClient.attributionRecord.findUnique({
          where: sourceFactWhere(reference),
          select: targetFactSelect
        })
      );
    case "reversal":
      return mapTargetFact(
        kind,
        await prismaClient.ledgerReversal.findUnique({
          where: sourceFactWhere(reference),
          select: targetFactSelect
        })
      );
    case "account_balance_snapshot":
      return mapTargetFact(
        kind,
        await prismaClient.accountBalanceSnapshot.findUnique({
          where: sourceFactWhere(reference),
          select: targetFactSelect
        })
      );
  }
}

function sourceFactWhere(reference: ManualTargetReference) {
  if (reference.target_idempotency_key) {
    return { idempotencyKey: reference.target_idempotency_key };
  }

  if (reference.target_fact_id) {
    return { id: reference.target_fact_id };
  }

  throw new Error("MANUAL_TARGET_REFERENCE_REQUIRED");
}

function mapTargetFact(
  kind: LedgerFactKind,
  row: {
    id: string;
    idempotencyKey: string;
    exchangeAccountId: string | null;
    asset: string | null;
    baseAsset: string | null;
    quoteAsset: string | null;
    strategyId: string | null;
    strategyVersion: string | null;
    payload: Prisma.JsonValue;
  } | null
): ManualTargetFact | null {
  return row ? { ...row, kind } : null;
}
