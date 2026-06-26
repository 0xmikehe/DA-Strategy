import { z } from "zod";
import { canonicalHash } from "./canonicalize";
import { IngestValidationError } from "./errors";
import type {
  LedgerDataSourceMode,
  LedgerFactCommand,
  LedgerFactDimensions,
  LedgerFactKind,
  LedgerFactOrigin,
  LedgerIngestCommand
} from "./types";

const isoDateTimeSchema = z.string().datetime({ offset: true });

const sourceModeSchema = z.enum(["fixture", "mock", "cassette", "remote_import", "live"]);

const factKindSchema = z.enum([
  "exchange_trade_fill",
  "exchange_order",
  "capital_flow_event",
  "external_trade",
  "attribution_record",
  "reversal",
  "account_balance_snapshot"
]);

const originSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("binance_user_data"),
    endpoint: z.string().min(1),
    original_source_mode: sourceModeSchema.optional()
  }),
  z.object({
    kind: z.literal("remote_export"),
    export_run_id: z.string().min(1),
    original_source_mode: sourceModeSchema.optional()
  }),
  z.object({ kind: z.literal("mock_scenario"), scenario_id: z.string().min(1) }),
  z.object({ kind: z.literal("cassette"), cassette_id: z.string().min(1) }),
  z.object({ kind: z.literal("fixture"), fixture_id: z.string().min(1) }),
  z.object({ kind: z.literal("manual_external_trade") }),
  z.object({ kind: z.literal("manual_attribution") }),
  z.object({ kind: z.literal("manual_reversal") })
]);

const actorSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("system"),
    name: z.enum(["ledger-worker", "mock-ledger-service", "fixture-seed", "cassette-seed"])
  }),
  z.object({ kind: z.literal("user"), user_id: z.string().min(1) }),
  z.object({ kind: z.literal("agent"), agent_id: z.string().min(1) }),
  z.object({ kind: z.literal("import_tool"), name: z.string().min(1) })
]);

const triggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scheduled_sync"), job_run_id: z.string().min(1) }),
  z.object({
    kind: z.literal("manual_sync"),
    job_run_id: z.string().min(1),
    requested_by: z.string().min(1)
  }),
  z.object({ kind: z.literal("remote_import"), import_run_id: z.string().min(1) }),
  z.object({ kind: z.literal("mock_generation"), scenario_id: z.string().min(1) }),
  z.object({ kind: z.literal("cassette_seed"), cassette_id: z.string().min(1) }),
  z.object({ kind: z.literal("fixture_seed"), fixture_id: z.string().min(1) }),
  z.object({ kind: z.literal("manual_entry"), request_id: z.string().min(1) }),
  z.object({ kind: z.literal("manual_attribution"), request_id: z.string().min(1) }),
  z.object({ kind: z.literal("manual_reversal"), request_id: z.string().min(1) })
]);

const packageMetadataSchema = z.object({
  schema_version: z.string().min(1),
  package_id: z.string().min(1),
  produced_at: isoDateTimeSchema,
  content_hash: z.string().min(1),
  source_env_id: z.string().min(1).optional(),
  sync_run_id: z.string().min(1).optional(),
  redaction_level: z.string().min(1).optional()
});

const importMetadataSchema = z.object({
  schema_version: z.string().min(1),
  export_run_id: z.string().min(1),
  source_env_id: z.string().min(1),
  sync_run_id: z.string().min(1).optional(),
  exported_at: isoDateTimeSchema,
  content_hash: z.string().min(1),
  redaction_level: z.string().min(1)
});

const syncMetadataSchema = z.object({
  job_run_id: z.string().min(1),
  exchange: z.literal("BINANCE"),
  account_scope: z.string().min(1),
  endpoint_group: z.string().min(1),
  request_window_start: isoDateTimeSchema.optional(),
  request_window_end: isoDateTimeSchema.optional()
});

const dimensionsSchema = z.object({
  exchange_account_id: z.string().min(1).optional(),
  asset: z.string().min(1).optional(),
  base_asset: z.string().min(1).optional(),
  quote_asset: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  external_id: z.string().min(1).optional(),
  strategy_id: z.string().min(1).optional(),
  strategy_version: z.string().min(1).optional(),
  snapshot_id: z.string().min(1).optional(),
  snapshot_time: isoDateTimeSchema.optional(),
  reported_scope: z.string().min(1).optional()
});

const factSchema = z.object({
  kind: factKindSchema,
  idempotency_key: z.string().min(1),
  natural_key: z.string().min(1),
  origin: originSchema.optional(),
  occurred_at: isoDateTimeSchema,
  source_event_time: isoDateTimeSchema.optional(),
  payload_hash: z.string().min(1).optional(),
  dimensions: dimensionsSchema.optional(),
  payload: z.record(z.unknown())
});

const cursorAdvancementSchema = z.object({
  owner: z.string().min(1),
  cursor_key: z.string().min(1),
  previous_cursor_value: z.string().min(1).optional(),
  next_cursor_value: z.string().min(1).optional(),
  high_watermark: isoDateTimeSchema.optional(),
  metadata_hash: z.string().min(1).optional()
});

const commandSchema = z.object({
  batch: z.object({
    idempotency_key: z.string().min(1),
    source_mode: sourceModeSchema,
    default_origin: originSchema.optional(),
    actor: actorSchema,
    trigger: triggerSchema,
    requested_at: isoDateTimeSchema,
    package_metadata: packageMetadataSchema.optional(),
    import_metadata: importMetadataSchema.optional(),
    sync_metadata: syncMetadataSchema.optional()
  }),
  facts: z.array(factSchema),
  cursor_advancements: z.array(cursorAdvancementSchema).optional()
});

const dimensionKeys = [
  "exchange_account_id",
  "asset",
  "base_asset",
  "quote_asset",
  "symbol",
  "external_id",
  "strategy_id",
  "strategy_version",
  "snapshot_id",
  "snapshot_time",
  "reported_scope"
] as const;

const decimalFieldPattern = /(^|_)(amount|balance|commission|fee|free|locked|price|qty|quantity|quote_qty|total|value)($|_)/i;
const decimalStringPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

type DimensionKey = (typeof dimensionKeys)[number];

export function validateLedgerIngestCommand(input: unknown): LedgerIngestCommand {
  const parsed = commandSchema.safeParse(input);

  if (!parsed.success) {
    throw new IngestValidationError("LEDGER_INGEST_VALIDATION_FAILED", parsed.error.message);
  }

  const command = parsed.data as LedgerIngestCommand;

  validateBatchMetadata(command);

  if (command.facts.length === 0 && (command.cursor_advancements?.length ?? 0) === 0) {
    throw new IngestValidationError(
      "LEDGER_INGEST_FACTS_REQUIRED",
      "facts may be empty only when a successful batch advances at least one cursor"
    );
  }

  const normalizedFacts = command.facts.map((fact) => normalizeFact(command.batch.source_mode, command.batch.default_origin, fact, command.batch.sync_metadata !== undefined));

  return {
    ...command,
    facts: normalizedFacts
  };
}

function validateBatchMetadata(command: LedgerIngestCommand) {
  const { batch } = command;

  if (batch.source_mode === "remote_import" && (!batch.package_metadata || !batch.import_metadata)) {
    throw new IngestValidationError(
      "LEDGER_INGEST_IMPORT_METADATA_REQUIRED",
      "remote_import batches require package_metadata and import_metadata"
    );
  }

  if ((batch.source_mode === "mock" || batch.source_mode === "cassette") && !batch.package_metadata) {
    throw new IngestValidationError(
      "LEDGER_INGEST_PACKAGE_METADATA_REQUIRED",
      `${batch.source_mode} batches require package_metadata`
    );
  }

  if (batch.source_mode === "live" && (command.cursor_advancements?.length ?? 0) > 0 && !batch.sync_metadata) {
    throw new IngestValidationError(
      "LEDGER_INGEST_SYNC_METADATA_REQUIRED",
      "live cursor advancement batches require sync_metadata"
    );
  }
}

function normalizeFact(
  sourceMode: LedgerDataSourceMode,
  batchOrigin: LedgerFactOrigin | undefined,
  fact: LedgerFactCommand,
  hasSyncMetadata: boolean
): LedgerFactCommand {
  const origin = fact.origin ?? batchOrigin;

  if (!origin) {
    throw new IngestValidationError("LEDGER_INGEST_ORIGIN_REQUIRED", "each fact must resolve to a fact origin");
  }

  if (sourceMode === "live" && origin.kind === "binance_user_data" && !hasSyncMetadata) {
    throw new IngestValidationError(
      "LEDGER_INGEST_SYNC_METADATA_REQUIRED",
      "live Binance-derived facts require sync_metadata"
    );
  }

  validateFinancialPayload(fact.payload);
  const dimensions = projectDimensions(fact.kind, fact.payload, fact.dimensions);
  const payloadHash = canonicalHash(fact.payload);

  if (fact.payload_hash !== undefined && fact.payload_hash !== payloadHash) {
    throw new IngestValidationError(
      "LEDGER_INGEST_PAYLOAD_HASH_MISMATCH",
      `payload_hash for ${fact.idempotency_key} does not match canonical payload`
    );
  }

  return {
    ...fact,
    origin,
    dimensions,
    payload_hash: payloadHash
  };
}

function validateFinancialPayload(payload: Record<string, unknown>) {
  for (const [key, value] of Object.entries(payload)) {
    if (!decimalFieldPattern.test(key)) {
      continue;
    }

    if (key.endsWith("_asset")) {
      continue;
    }

    if (typeof value === "number") {
      throw new IngestValidationError(
        "LEDGER_INGEST_DECIMAL_STRING_REQUIRED",
        `financial payload field ${key} must be a decimal string`
      );
    }

    if (typeof value === "string" && !decimalStringPattern.test(value)) {
      throw new IngestValidationError(
        "LEDGER_INGEST_DECIMAL_STRING_INVALID",
        `financial payload field ${key} is not a valid decimal string`
      );
    }
  }
}

function projectDimensions(
  kind: LedgerFactKind,
  payload: Record<string, unknown>,
  explicitDimensions: LedgerFactDimensions | undefined
): LedgerFactDimensions {
  const projected: LedgerFactDimensions = {};

  for (const key of dimensionKeys) {
    const payloadValue = payload[key];
    const explicitValue = explicitDimensions?.[key];

    if (explicitValue !== undefined && payloadValue !== undefined && String(payloadValue) !== explicitValue) {
      throw new IngestValidationError(
        "LEDGER_INGEST_DIMENSION_CONFLICT",
        `dimension ${key} conflicts with payload value`
      );
    }

    const value = explicitValue ?? payloadStringValue(key, payloadValue);
    if (value !== undefined) {
      projected[key] = value;
    }
  }

  if (kind === "account_balance_snapshot") {
    requireBalanceSnapshotDimension(projected, "exchange_account_id");
    requireBalanceSnapshotDimension(projected, "asset");
    requireBalanceSnapshotDimension(projected, "snapshot_time");
    requireBalanceSnapshotDimension(projected, "reported_scope");
  }

  return projected;
}

function payloadStringValue(key: DimensionKey, value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new IngestValidationError(
      "LEDGER_INGEST_DIMENSION_CONFLICT",
      `payload dimension ${key} must be a string when present`
    );
  }

  return value;
}

function requireBalanceSnapshotDimension(dimensions: LedgerFactDimensions, key: keyof LedgerFactDimensions) {
  if (!dimensions[key]) {
    throw new IngestValidationError(
      "LEDGER_INGEST_DIMENSION_CONFLICT",
      `account_balance_snapshot requires ${key}`
    );
  }
}
