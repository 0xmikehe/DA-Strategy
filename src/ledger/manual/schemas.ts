import { z } from "zod";

const decimalStringSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const positiveDecimalStringSchema = decimalStringSchema.refine((value) => !/^0(?:\.0+)?$/.test(value), {
  message: "must be a positive decimal string"
});
const isoPastDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).getTime() <= Date.now(), {
    message: "occurred_at cannot be in the future"
  });
const targetFactKindSchema = z.enum([
  "exchange_trade_fill",
  "capital_flow_event",
  "external_trade"
]);
const reversibleFactKindSchema = z.enum([
  "exchange_trade_fill",
  "exchange_order",
  "capital_flow_event",
  "external_trade",
  "attribution_record",
  "reversal",
  "account_balance_snapshot"
]);
const targetReferenceShape = {
  target_fact_id: z.string().min(1).optional(),
  target_idempotency_key: z.string().min(1).optional()
};

export const ManualExternalTradeCommandSchema = z
  .object({
    request_id: z.string().min(1),
    wallet_account_id: z.string().min(1),
    side: z.enum(["buy", "sell"]),
    base_asset: z.string().min(1),
    quote_asset: z.string().min(1),
    base_qty: positiveDecimalStringSchema,
    price: positiveDecimalStringSchema.optional(),
    quote_qty: positiveDecimalStringSchema.optional(),
    occurred_at: isoPastDateTimeSchema,
    fee_qty: positiveDecimalStringSchema.optional(),
    fee_asset: z.string().min(1).optional(),
    tx_id: z.string().min(1).optional(),
    venue: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    strategy_id: z.string().min(1).optional(),
    strategy_version: z.string().min(1).optional()
  })
  .strict()
  .refine((value) => value.price !== undefined || value.quote_qty !== undefined, {
    message: "price or quote_qty is required"
  })
  .refine((value) => (value.strategy_id === undefined) === (value.strategy_version === undefined), {
    message: "strategy_id and strategy_version must be provided together"
  });

export const ManualAttributionCommandSchema = z
  .object({
    request_id: z.string().min(1),
    target_fact_kind: targetFactKindSchema,
    ...targetReferenceShape,
    assignment_kind: z.enum(["strategy", "external", "unassigned"]),
    strategy_id: z.string().min(1).optional(),
    strategy_version: z.string().min(1).optional(),
    reason_code: z.string().min(1),
    occurred_at: isoPastDateTimeSchema,
    note: z.string().min(1).optional()
  })
  .strict()
  .refine((value) => value.target_fact_id !== undefined || value.target_idempotency_key !== undefined, {
    message: "target_fact_id or target_idempotency_key is required"
  })
  .superRefine((value, ctx) => {
    if (value.assignment_kind === "strategy") {
      if (!value.strategy_id || !value.strategy_version) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "strategy attribution requires strategy_id and strategy_version"
        });
      }
      return;
    }

    if (value.strategy_id || value.strategy_version) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "non-strategy attribution cannot include strategy fields"
      });
    }
  });

export const ManualReversalCommandSchema = z
  .object({
    request_id: z.string().min(1),
    target_fact_kind: reversibleFactKindSchema,
    ...targetReferenceShape,
    reason_code: z.string().min(1),
    note: z.string().min(1),
    occurred_at: isoPastDateTimeSchema
  })
  .strict()
  .refine((value) => value.target_fact_id !== undefined || value.target_idempotency_key !== undefined, {
    message: "target_fact_id or target_idempotency_key is required"
  });

export type ManualExternalTradeCommand = z.infer<typeof ManualExternalTradeCommandSchema>;
export type ManualAttributionCommand = z.infer<typeof ManualAttributionCommandSchema>;
export type ManualReversalCommand = z.infer<typeof ManualReversalCommandSchema>;
