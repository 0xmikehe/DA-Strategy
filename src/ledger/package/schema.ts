import { z } from "zod";
import type { LedgerExportPackage } from "./types";

export class LedgerPackageValidationError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(`${code}: ${message}`);
    this.name = "LedgerPackageValidationError";
  }
}

const isoDateTimeSchema = z.string().datetime({ offset: true });
const sourceModeSchema = z.enum(["fixture", "mock", "cassette", "remote_import", "live"]);

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

const packageManifestSchema = z
  .object({
    schema_version: z.literal("ledger.export.v1"),
    package_id: z.string().min(1),
    package_kind: z.enum(["mock", "remote_export", "cassette"]),
    export_run_id: z.string().min(1),
    source_env_id: z.string().min(1),
    sync_run_id: z.string().min(1).optional(),
    scenario_id: z.string().min(1).optional(),
    cassette_id: z.string().min(1).optional(),
    produced_at: isoDateTimeSchema,
    content_hash: z.string(),
    redaction_level: z.string().min(1)
  })
  .strict();

const packageSourceFactRowSchema = z
  .object({
    idempotency_key: z.string().min(1),
    natural_key: z.string().min(1),
    origin: originSchema.optional(),
    trigger: triggerSchema.optional(),
    occurred_at: isoDateTimeSchema,
    source_event_time: isoDateTimeSchema.optional(),
    payload_hash: z.string().min(1).optional(),
    dimensions: dimensionsSchema.optional(),
    payload: z.record(z.unknown())
  })
  .strict();

const summaryRowSchema = z.record(z.unknown());

const packageSchema = z
  .object({
    manifest: packageManifestSchema,
    exchange_accounts: z.array(summaryRowSchema),
    api_key_health_summaries: z.array(summaryRowSchema),
    exchange_trade_fills: z.array(packageSourceFactRowSchema),
    exchange_orders: z.array(packageSourceFactRowSchema),
    capital_flow_events: z.array(packageSourceFactRowSchema),
    external_trades: z.array(packageSourceFactRowSchema),
    attribution_records: z.array(packageSourceFactRowSchema),
    reversals: z.array(packageSourceFactRowSchema),
    account_balance_snapshots: z.array(packageSourceFactRowSchema),
    reconciliation_results: z.array(summaryRowSchema),
    sync_cursor_summaries: z.array(summaryRowSchema),
    raw_payload_redacted: z.array(summaryRowSchema)
  })
  .strict();

const decimalFieldPattern = /(^|_)(amount|balance|commission|fee|free|locked|price|qty|quantity|quote_qty|total|value)($|_)/i;
const decimalStringPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const secretFieldNames = new Set(["apikey", "apisecret", "signature", "signedurl", "headers", "secret", "listenkey"]);

export function validateLedgerPackage(input: unknown): LedgerExportPackage {
  const parsed = packageSchema.safeParse(input);

  if (!parsed.success) {
    throw new LedgerPackageValidationError("LEDGER_PACKAGE_VALIDATION_FAILED", parsed.error.message);
  }

  validateNoSecretFields(parsed.data);
  validateDecimalStrings(parsed.data);

  return parsed.data as LedgerExportPackage;
}

function validateNoSecretFields(value: unknown, path: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateNoSecretFields(entry, [...path, String(index)]));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
    if (secretFieldNames.has(normalizedKey)) {
      throw new LedgerPackageValidationError(
        "LEDGER_PACKAGE_SECRET_FIELD",
        `secret-like field ${[...path, key].join(".")} is not allowed in ledger packages`
      );
    }

    validateNoSecretFields(entryValue, [...path, key]);
  }
}

function validateDecimalStrings(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((entry) => validateDecimalStrings(entry));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (decimalFieldPattern.test(key) && !key.endsWith("_asset")) {
      validateDecimalValue(key, entryValue);
    }

    validateDecimalStrings(entryValue);
  }
}

function validateDecimalValue(key: string, value: unknown) {
  if (typeof value === "number") {
    throw new LedgerPackageValidationError(
      "LEDGER_PACKAGE_DECIMAL_STRING_REQUIRED",
      `financial package field ${key} must be a decimal string`
    );
  }

  if (typeof value === "string" && !decimalStringPattern.test(value)) {
    throw new LedgerPackageValidationError(
      "LEDGER_PACKAGE_DECIMAL_STRING_INVALID",
      `financial package field ${key} is not a valid decimal string`
    );
  }
}
