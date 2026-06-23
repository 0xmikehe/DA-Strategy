import { z } from "zod";

const stableIdSchema = z.string().min(1);
const isoDateTimeStringSchema = z.string().datetime({ offset: true });
const decimalStringSchema = z.string().regex(/^-?\d+(\.\d+)?$/, "Expected decimal string");

const dataHealthSchema = z.enum(["complete", "partial", "stale", "missing"]);
const bindingStateSchema = z.enum(["active", "warn", "blocked"]);
const strategyVersionStatusSchema = z.enum(["draft", "active", "superseded", "retired"]);
const plannedActionStatusSchema = z.enum(["draft", "confirmed", "dismissed", "executed_manually"]);
const assetRoleSchema = z.enum(["stable", "core", "satellite", "fee_asset"]);
const assetStatusSchema = z.enum(["active", "disabled", "retired"]);

export const activeSignalSchema = z
  .object({
    signal_id: stableIdSchema,
    signal_version: z.string().min(1),
    lifecycle_state: z.literal("enabled"),
    value: z.string().min(1),
    raw_value: z.string().min(1),
    evaluated_at: isoDateTimeStringSchema,
    reason_codes: z.array(z.string().min(1))
  })
  .strict();

export const activeSignalSetSchema = z
  .object({
    snapshot_id: stableIdSchema,
    as_of: isoDateTimeStringSchema,
    signals: z.array(activeSignalSchema),
    data_health: dataHealthSchema
  })
  .strict();

export const signalSnapshotRefSchema = z
  .object({
    snapshot_id: stableIdSchema,
    created_at: isoDateTimeStringSchema,
    schema_version: z.string().min(1),
    content_hash: z.string().min(1)
  })
  .strict();

export const signalSnapshotInputRefSchema = z
  .object({
    kind: z.enum(["market_candle_fact", "funding_rate_fact"]),
    ref: z
      .object({
        source: z.string().min(1),
        symbol: z.string().min(1),
        interval: z.string().min(1).optional(),
        open_time: isoDateTimeStringSchema.optional(),
        funding_time: isoDateTimeStringSchema.optional()
      })
      .strict()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "market_candle_fact") {
      if (!value.ref.interval) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ref", "interval"],
          message: "market_candle_fact refs require interval"
        });
      }
      if (!value.ref.open_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ref", "open_time"],
          message: "market_candle_fact refs require open_time"
        });
      }
    }

    if (value.kind === "funding_rate_fact" && !value.ref.funding_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ref", "funding_time"],
        message: "funding_rate_fact refs require funding_time"
      });
    }
  });

export const signalSnapshotContentSchema = z
  .object({
    snapshot_id: stableIdSchema,
    evaluated_at: isoDateTimeStringSchema,
    schema_version: z.string().min(1),
    active_signal_set: activeSignalSetSchema,
    input_refs: z.array(signalSnapshotInputRefSchema),
    data_health: dataHealthSchema
  })
  .strict();

export const ledgerAssetPositionSchema = z
  .object({
    asset: z.string().min(1),
    free_qty: decimalStringSchema,
    locked_qty: decimalStringSchema,
    total_qty: decimalStringSchema,
    cost_basis_quote: decimalStringSchema
  })
  .strict();

export const ledgerPositionViewSchema = z
  .object({
    strategy_id: stableIdSchema,
    strategy_version: z.string().min(1),
    as_of: isoDateTimeStringSchema,
    assets: z.array(ledgerAssetPositionSchema)
  })
  .strict();

export const ledgerTradeViewSchema = z
  .object({
    trade_id: stableIdSchema,
    exchange_account_id: stableIdSchema,
    strategy_id: stableIdSchema,
    strategy_version: z.string().min(1),
    snapshot_id: stableIdSchema,
    symbol: z.string().min(1),
    side: z.enum(["buy", "sell"]),
    price: decimalStringSchema,
    qty: decimalStringSchema,
    commission_asset: z.string().min(1),
    commission_qty: decimalStringSchema,
    time: isoDateTimeStringSchema
  })
  .strict();

export const capitalFlowViewSchema = z
  .object({
    event_id: stableIdSchema,
    strategy_id: stableIdSchema.optional(),
    flow_type: z.enum(["deposit", "withdrawal", "transfer_in", "transfer_out"]),
    asset: z.string().min(1),
    amount: decimalStringSchema,
    event_time: isoDateTimeStringSchema,
    source_account: stableIdSchema.optional(),
    target_account: stableIdSchema.optional()
  })
  .strict();

export const accountBindingStatusSchema = z
  .object({
    strategy_id: stableIdSchema,
    exchange_account_id: stableIdSchema,
    binding_state: bindingStateSchema,
    credential_health: z.enum(["ok", "warn", "blocked"]),
    last_checked_at: isoDateTimeStringSchema,
    blocking_reasons: z.array(z.string()),
    key_ref: z.string().min(1).optional()
  })
  .strict();

export const strategyBindingRefSchema = z
  .object({
    strategy_id: stableIdSchema,
    strategy_version: z.string().min(1),
    exchange_account_id: stableIdSchema,
    binding_state: bindingStateSchema,
    effective_from: isoDateTimeStringSchema,
    effective_to: isoDateTimeStringSchema.optional()
  })
  .strict();

export const strategyVersionRefSchema = z
  .object({
    strategy_id: stableIdSchema,
    strategy_version: z.string().min(1),
    effective_from: isoDateTimeStringSchema,
    effective_to: isoDateTimeStringSchema.optional(),
    status: strategyVersionStatusSchema
  })
  .strict();

export const assetPoolItemSchema = z
  .object({
    strategy_id: stableIdSchema,
    strategy_version: z.string().min(1),
    asset: z.string().min(1),
    role: assetRoleSchema,
    status: assetStatusSchema,
    effective_from: isoDateTimeStringSchema,
    effective_to: isoDateTimeStringSchema.optional()
  })
  .strict();

export const syncSymbolSetSchema = z
  .object({
    strategy_id: stableIdSchema,
    strategy_version: z.string().min(1),
    spot_symbols: z.array(z.string().min(1)),
    derived_from_assets: z.array(z.string().min(1)),
    effective_from: isoDateTimeStringSchema
  })
  .strict();

export const plannedActionSchema = z
  .object({
    action_id: stableIdSchema,
    strategy_id: stableIdSchema,
    strategy_version: z.string().min(1),
    snapshot_id: stableIdSchema,
    action_type: z.enum(["hold", "rebalance", "review", "manual_check"]),
    target_allocation_band_ref: stableIdSchema,
    reason_codes: z.array(z.string().min(1)),
    created_at: isoDateTimeStringSchema,
    status: plannedActionStatusSchema
  })
  .strict();

export const reviewDraftSchema = z
  .object({
    review_id: stableIdSchema,
    strategy_id: stableIdSchema,
    strategy_version: z.string().min(1),
    period_start: isoDateTimeStringSchema,
    period_end: isoDateTimeStringSchema,
    snapshot_refs: z.array(signalSnapshotRefSchema),
    sections: z.array(
      z
        .object({
          key: z.string().min(1),
          title: z.string().min(1),
          body: z.string().min(1)
        })
        .strict()
    ),
    status: z.enum(["draft", "confirmed", "superseded"])
  })
  .strict();
