import { z } from "zod";

const isoDateTimeStringSchema = z.string().datetime({ offset: true });
const decimalStringSchema = z.string().regex(/^-?\d+(\.\d+)?$/, "Expected decimal string");
const contentHashSchema = z.string().regex(/^[a-f0-9]{64}$/, "Expected sha256 hex string");

export const marketDataFactTypeSchema = z.enum([
  "open_interest_hist",
  "global_long_short_account_ratio",
  "top_long_short_position_ratio",
  "top_long_short_account_ratio"
]);

export const marketDataCollectorStateSchema = z.enum([
  "shadow_collecting",
  "partial",
  "stale",
  "empty",
  "blocked"
]);

export const marketDataFactRowSchema = z
  .object({
    id: z.string().min(1),
    source: z.literal("binance_usds_futures"),
    fact_type: marketDataFactTypeSchema,
    symbol: z.string().min(1),
    period: z.string().min(1),
    event_time: isoDateTimeStringSchema,
    collected_at: isoDateTimeStringSchema,
    value_label: z.string().min(1),
    primary_value: decimalStringSchema,
    secondary_value: decimalStringSchema.optional(),
    content_hash: contentHashSchema
  })
  .strict();

export const marketDataMetricSummarySchema = z
  .object({
    fact_type: marketDataFactTypeSchema,
    label: z.string().min(1),
    latest: marketDataFactRowSchema.optional(),
    latest_lag_minutes: z.number().int().nonnegative().optional(),
    points_24h: z.number().int().nonnegative(),
    points_7d: z.number().int().nonnegative(),
    missing_points_24h: z.number().int().nonnegative(),
    state: marketDataCollectorStateSchema
  })
  .strict();

export const p15MarketDataReadModelSchema = z
  .object({
    generated_at: isoDateTimeStringSchema,
    source: z.literal("binance_usds_futures"),
    mode: z.literal("shadow"),
    symbols: z.array(z.string().min(1)),
    periods: z.array(z.string().min(1)),
    selected_symbol: z.string().min(1),
    selected_period: z.string().min(1),
    selected_range: z.enum(["24h", "7d", "30d"]),
    collector_state: marketDataCollectorStateSchema,
    last_success_at: isoDateTimeStringSchema.optional(),
    metrics: z.array(marketDataMetricSummarySchema),
    history: z.array(marketDataFactRowSchema)
  })
  .strict();
