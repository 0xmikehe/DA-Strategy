import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { canonicalHash } from "./canonicalize";
import { LedgerIngestConflictError } from "./errors";
import type {
  LedgerCursorAdvancement,
  LedgerFactCommand,
  LedgerFactKind,
  LedgerIngestCommand,
  LedgerIngestResult
} from "./types";
import { validateLedgerIngestCommand } from "./validation";

type TransactionClient = Prisma.TransactionClient;

type SourceFactRow = {
  id: string;
  idempotencyKey: string;
  naturalKey: string;
  payloadHash: string;
};

type ExistingSourceFact = SourceFactRow & {
  kind: LedgerFactKind;
};

const factKinds: LedgerFactKind[] = [
  "exchange_trade_fill",
  "exchange_order",
  "capital_flow_event",
  "external_trade",
  "attribution_record",
  "reversal",
  "account_balance_snapshot"
];

const sourceFactSelect = {
  id: true,
  idempotencyKey: true,
  naturalKey: true,
  payloadHash: true
} as const;

export async function appendLedgerFacts(input: LedgerIngestCommand): Promise<LedgerIngestResult> {
  const command = validateLedgerIngestCommand(input);
  const batchHash = canonicalHash({
    batch: command.batch,
    facts: command.facts,
    cursor_advancements: command.cursor_advancements ?? []
  });

  return prisma.$transaction(async (tx) => {
    const existingBatch = await tx.ledgerIngestBatch.findUnique({
      where: { idempotencyKey: command.batch.idempotency_key }
    });

    if (existingBatch) {
      if (existingBatch.canonicalHash !== batchHash) {
        throw new LedgerIngestConflictError(
          "LEDGER_INGEST_IDEMPOTENCY_CONFLICT",
          `batch idempotency key ${command.batch.idempotency_key} was reused with different content`
        );
      }

      return storedBatchResult(existingBatch.resultSummary);
    }

    const batch = await tx.ledgerIngestBatch.create({
      data: {
        idempotencyKey: command.batch.idempotency_key,
        sourceMode: command.batch.source_mode,
        defaultOrigin: optionalJson(command.batch.default_origin),
        actor: inputJson(command.batch.actor),
        trigger: inputJson(command.batch.trigger),
        requestedAt: new Date(command.batch.requested_at),
        packageMetadata: optionalJson(command.batch.package_metadata),
        importMetadata: optionalJson(command.batch.import_metadata),
        syncMetadata: optionalJson(command.batch.sync_metadata),
        canonicalHash: batchHash
      }
    });

    const result = emptyResult(batch.id, command);
    const replayHint = replayHintAccumulator();

    for (const fact of command.facts) {
      const existingFact = await findExistingFact(tx, fact);

      if (existingFact) {
        assertExistingFactMatchesCommand(existingFact, fact);
        await recordObservation(tx, batch.id, fact, existingFact, "duplicate");
        result.skipped_duplicate[fact.kind] += 1;
        replayHint.add(fact);
        continue;
      }

      if (fact.kind === "reversal") {
        await assertReversalCanAppend(tx, fact);
      }

      const createdFact = await createSourceFact(tx, command.batch.source_mode, fact);
      await recordObservation(tx, batch.id, fact, { ...createdFact, kind: fact.kind }, "inserted");
      result.inserted[fact.kind] += 1;
      replayHint.add(fact);
    }

    for (const cursorAdvancement of command.cursor_advancements ?? []) {
      await advanceCursor(tx, cursorAdvancement);
      result.cursor_advancements += 1;
    }

    result.replay_hint = replayHint.toResult();

    await tx.ledgerIngestBatch.update({
      where: { id: batch.id },
      data: { resultSummary: inputJson(result) }
    });

    return result;
  });
}

function emptyResult(batchId: string, command: LedgerIngestCommand): LedgerIngestResult {
  return {
    batch_id: batchId,
    batch_idempotency_key: command.batch.idempotency_key,
    source_mode: command.batch.source_mode,
    inserted: emptyCounts(),
    skipped_duplicate: emptyCounts(),
    conflicted: emptyCounts(),
    cursor_advancements: 0,
    replay_hint: {
      affected_exchange_account_ids: [],
      affected_strategy_ids: [],
      affected_assets: []
    }
  };
}

function emptyCounts(): Record<LedgerFactKind, number> {
  return Object.fromEntries(factKinds.map((kind) => [kind, 0])) as Record<LedgerFactKind, number>;
}

function replayHintAccumulator() {
  let earliestOccurredAt: string | undefined;
  const exchangeAccountIds = new Set<string>();
  const strategyIds = new Set<string>();
  const assets = new Set<string>();

  return {
    add(fact: LedgerFactCommand) {
      if (!earliestOccurredAt || fact.occurred_at < earliestOccurredAt) {
        earliestOccurredAt = fact.occurred_at;
      }

      if (fact.dimensions?.exchange_account_id) {
        exchangeAccountIds.add(fact.dimensions.exchange_account_id);
      }

      if (fact.dimensions?.strategy_id) {
        strategyIds.add(fact.dimensions.strategy_id);
      }

      if (fact.dimensions?.asset) {
        assets.add(fact.dimensions.asset);
      }
    },
    toResult(): LedgerIngestResult["replay_hint"] {
      return {
        earliest_occurred_at: earliestOccurredAt,
        affected_exchange_account_ids: [...exchangeAccountIds].sort(),
        affected_strategy_ids: [...strategyIds].sort(),
        affected_assets: [...assets].sort()
      };
    }
  };
}

async function findExistingFact(tx: TransactionClient, fact: LedgerFactCommand): Promise<ExistingSourceFact | null> {
  const byIdempotencyKey = await findFactByIdempotencyKey(tx, fact.idempotency_key);
  if (byIdempotencyKey) {
    return byIdempotencyKey;
  }

  const byNaturalKey = await findFactByNaturalKey(tx, fact.kind, fact.natural_key);
  return byNaturalKey ? { ...byNaturalKey, kind: fact.kind } : null;
}

async function findFactByIdempotencyKey(
  tx: TransactionClient,
  idempotencyKey: string
): Promise<ExistingSourceFact | null> {
  for (const kind of factKinds) {
    const row = await findFactRowByIdempotencyKey(tx, kind, idempotencyKey);
    if (row) {
      return { ...row, kind };
    }
  }

  return null;
}

async function findFactRowByIdempotencyKey(
  tx: TransactionClient,
  kind: LedgerFactKind,
  idempotencyKey: string
): Promise<SourceFactRow | null> {
  switch (kind) {
    case "exchange_trade_fill":
      return tx.exchangeTradeFill.findUnique({ where: { idempotencyKey }, select: sourceFactSelect });
    case "exchange_order":
      return tx.exchangeOrder.findUnique({ where: { idempotencyKey }, select: sourceFactSelect });
    case "capital_flow_event":
      return tx.capitalFlowEvent.findUnique({ where: { idempotencyKey }, select: sourceFactSelect });
    case "external_trade":
      return tx.externalTrade.findUnique({ where: { idempotencyKey }, select: sourceFactSelect });
    case "attribution_record":
      return tx.attributionRecord.findUnique({ where: { idempotencyKey }, select: sourceFactSelect });
    case "reversal":
      return tx.ledgerReversal.findUnique({ where: { idempotencyKey }, select: sourceFactSelect });
    case "account_balance_snapshot":
      return tx.accountBalanceSnapshot.findUnique({ where: { idempotencyKey }, select: sourceFactSelect });
  }
}

async function findFactByNaturalKey(
  tx: TransactionClient,
  kind: LedgerFactKind,
  naturalKey: string
): Promise<SourceFactRow | null> {
  switch (kind) {
    case "exchange_trade_fill":
      return tx.exchangeTradeFill.findUnique({ where: { naturalKey }, select: sourceFactSelect });
    case "exchange_order":
      return tx.exchangeOrder.findUnique({ where: { naturalKey }, select: sourceFactSelect });
    case "capital_flow_event":
      return tx.capitalFlowEvent.findUnique({ where: { naturalKey }, select: sourceFactSelect });
    case "external_trade":
      return tx.externalTrade.findUnique({ where: { naturalKey }, select: sourceFactSelect });
    case "attribution_record":
      return tx.attributionRecord.findUnique({ where: { naturalKey }, select: sourceFactSelect });
    case "reversal":
      return tx.ledgerReversal.findUnique({ where: { naturalKey }, select: sourceFactSelect });
    case "account_balance_snapshot":
      return tx.accountBalanceSnapshot.findUnique({ where: { naturalKey }, select: sourceFactSelect });
  }
}

function assertExistingFactMatchesCommand(existingFact: ExistingSourceFact, fact: LedgerFactCommand) {
  if (existingFact.kind !== fact.kind) {
    throw new LedgerIngestConflictError(
      "LEDGER_INGEST_FACT_CONFLICT",
      `fact idempotency key ${fact.idempotency_key} already belongs to ${existingFact.kind}`
    );
  }

  if (existingFact.naturalKey !== fact.natural_key) {
    throw new LedgerIngestConflictError(
      "LEDGER_INGEST_FACT_CONFLICT",
      `fact idempotency key ${fact.idempotency_key} was reused with a different natural key`
    );
  }

  if (existingFact.payloadHash !== fact.payload_hash) {
    throw new LedgerIngestConflictError(
      "LEDGER_INGEST_FACT_CONFLICT",
      `fact ${fact.idempotency_key} conflicts with an existing payload hash`
    );
  }
}

async function assertReversalCanAppend(tx: TransactionClient, fact: LedgerFactCommand) {
  const targetFactKind = stringPayloadValue(fact, "target_fact_kind") as LedgerFactKind;
  const targetFactIdempotencyKey = stringPayloadValue(fact, "target_fact_idempotency_key");
  const targetFact = await findFactByIdempotencyKey(tx, targetFactIdempotencyKey);

  if (!targetFact || targetFact.kind !== targetFactKind) {
    throw new LedgerIngestConflictError(
      "LEDGER_INGEST_REVERSAL_TARGET_NOT_FOUND",
      `reversal target ${targetFactKind}:${targetFactIdempotencyKey} was not found`
    );
  }

  const existingReversal = await tx.ledgerReversal.findUnique({
    where: {
      targetFactKind_targetFactIdempotencyKey: {
        targetFactKind,
        targetFactIdempotencyKey
      }
    },
    select: { idempotencyKey: true }
  });

  if (existingReversal && existingReversal.idempotencyKey !== fact.idempotency_key) {
    throw new LedgerIngestConflictError(
      "LEDGER_INGEST_REVERSAL_TARGET_ALREADY_REVERSED",
      `target ${targetFactKind}:${targetFactIdempotencyKey} has already been reversed`
    );
  }
}

async function createSourceFact(
  tx: TransactionClient,
  sourceMode: LedgerIngestCommand["batch"]["source_mode"],
  fact: LedgerFactCommand
): Promise<SourceFactRow> {
  const commonData = sourceFactCreateData(sourceMode, fact);

  switch (fact.kind) {
    case "exchange_trade_fill":
      return tx.exchangeTradeFill.create({ data: commonData, select: sourceFactSelect });
    case "exchange_order":
      return tx.exchangeOrder.create({ data: commonData, select: sourceFactSelect });
    case "capital_flow_event":
      return tx.capitalFlowEvent.create({ data: commonData, select: sourceFactSelect });
    case "external_trade":
      return tx.externalTrade.create({ data: commonData, select: sourceFactSelect });
    case "attribution_record":
      return tx.attributionRecord.create({ data: commonData, select: sourceFactSelect });
    case "reversal":
      return tx.ledgerReversal.create({
        data: {
          ...commonData,
          targetFactKind: stringPayloadValue(fact, "target_fact_kind") as LedgerFactKind,
          targetFactIdempotencyKey: stringPayloadValue(fact, "target_fact_idempotency_key"),
          reasonCode: stringPayloadValue(fact, "reason_code")
        },
        select: sourceFactSelect
      });
    case "account_balance_snapshot":
      return tx.accountBalanceSnapshot.create({ data: commonData, select: sourceFactSelect });
  }
}

function sourceFactCreateData(sourceMode: LedgerIngestCommand["batch"]["source_mode"], fact: LedgerFactCommand) {
  const dimensions = fact.dimensions ?? {};

  return {
    idempotencyKey: fact.idempotency_key,
    naturalKey: fact.natural_key,
    sourceMode,
    origin: inputJson(fact.origin),
    occurredAt: new Date(fact.occurred_at),
    sourceEventTime: optionalDate(fact.source_event_time),
    exchangeAccountId: dimensions.exchange_account_id,
    asset: dimensions.asset,
    baseAsset: dimensions.base_asset,
    quoteAsset: dimensions.quote_asset,
    symbol: dimensions.symbol,
    externalId: dimensions.external_id,
    strategyId: dimensions.strategy_id,
    strategyVersion: dimensions.strategy_version,
    snapshotId: dimensions.snapshot_id,
    snapshotTime: optionalDate(dimensions.snapshot_time),
    reportedScope: dimensions.reported_scope,
    payloadHash: fact.payload_hash ?? canonicalHash(fact.payload),
    payload: inputJson(fact.payload)
  };
}

async function recordObservation(
  tx: TransactionClient,
  batchId: string,
  fact: LedgerFactCommand,
  row: ExistingSourceFact,
  status: "inserted" | "duplicate"
) {
  await tx.ledgerFactObservation.create({
    data: {
      batchId,
      factKind: fact.kind,
      factTableId: row.id,
      idempotencyKey: fact.idempotency_key,
      naturalKey: fact.natural_key,
      payloadHash: fact.payload_hash ?? canonicalHash(fact.payload),
      status
    }
  });
}

async function advanceCursor(tx: TransactionClient, cursorAdvancement: LedgerCursorAdvancement) {
  await tx.syncCursor.upsert({
    where: {
      owner_cursorKey: {
        owner: cursorAdvancement.owner,
        cursorKey: cursorAdvancement.cursor_key
      }
    },
    create: {
      owner: cursorAdvancement.owner,
      cursorKey: cursorAdvancement.cursor_key,
      cursorValue: cursorAdvancement.next_cursor_value,
      highWatermark: optionalDate(cursorAdvancement.high_watermark),
      metadata: optionalCursorMetadata(cursorAdvancement)
    },
    update: {
      cursorValue: cursorAdvancement.next_cursor_value,
      highWatermark: optionalDate(cursorAdvancement.high_watermark),
      metadata: optionalCursorMetadata(cursorAdvancement)
    }
  });
}

function optionalCursorMetadata(cursorAdvancement: LedgerCursorAdvancement): Prisma.InputJsonValue | undefined {
  if (!cursorAdvancement.previous_cursor_value && !cursorAdvancement.metadata_hash) {
    return undefined;
  }

  return inputJson({
    previous_cursor_value: cursorAdvancement.previous_cursor_value,
    metadata_hash: cursorAdvancement.metadata_hash
  });
}

function storedBatchResult(resultSummary: Prisma.JsonValue | null): LedgerIngestResult {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    throw new LedgerIngestConflictError(
      "LEDGER_INGEST_IDEMPOTENCY_CONFLICT",
      "existing ledger ingest batch is missing its stored result summary"
    );
  }

  return resultSummary as unknown as LedgerIngestResult;
}

function stringPayloadValue(fact: LedgerFactCommand, key: string): string {
  const value = fact.payload[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new LedgerIngestConflictError("LEDGER_INGEST_FACT_CONFLICT", `${fact.kind} requires payload.${key}`);
  }

  return value;
}

function optionalDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function optionalJson(value: unknown | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : inputJson(value);
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
