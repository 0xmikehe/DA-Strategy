import { describe, expect, it } from "vitest";
import {
  activeSignalSetSchema,
  ledgerTradeViewSchema,
  plannedActionSchema,
  reviewDraftSchema,
  signalSnapshotContentSchema
} from "@/contracts/phase1.schemas";

const validActiveSignalSet = {
  snapshot_id: "snap_2026_06_19_0001",
  as_of: "2026-06-19T00:00:00.000Z",
  data_health: "complete",
  signals: [
    {
      signal_id: "btc_trend",
      signal_version: "v1",
      lifecycle_state: "enabled",
      value: "risk_on",
      raw_value: "close_above_previous",
      evaluated_at: "2026-06-19T00:00:00.000Z",
      reason_codes: ["btc_trend_up"]
    }
  ]
};

describe("Phase 1 runtime schemas", () => {
  it("accepts enabled active signals and rejects non-enabled lifecycle states", () => {
    expect(activeSignalSetSchema.parse(validActiveSignalSet)).toMatchObject({
      snapshot_id: "snap_2026_06_19_0001"
    });

    const result = activeSignalSetSchema.safeParse({
      ...validActiveSignalSet,
      signals: [
        {
          ...validActiveSignalSet.signals[0],
          lifecycle_state: "shadow"
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("rejects JS numbers for decimal-string contract fields", () => {
    const result = ledgerTradeViewSchema.safeParse({
      trade_id: "trade_001",
      exchange_account_id: "acct_fixture",
      strategy_id: "core_allocation_lt",
      strategy_version: "v1",
      snapshot_id: "snap_2026_06_19_0001",
      symbol: "BTCUSDT",
      side: "buy",
      price: 65000,
      qty: "0.10000000",
      commission_asset: "USDT",
      commission_qty: "6.50",
      time: "2026-06-19T00:05:00.000Z"
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid ISO datetime strings at cross-layer boundaries", () => {
    const result = activeSignalSetSchema.safeParse({
      ...validActiveSignalSet,
      as_of: "2026/06/19 00:00"
    });

    expect(result.success).toBe(false);
  });

  it("requires planned actions to preserve snapshot and strategy-version traceability", () => {
    const result = plannedActionSchema.safeParse({
      action_id: "act_001",
      strategy_id: "core_allocation_lt",
      action_type: "hold",
      target_allocation_band_ref: "core_v1_risk_on",
      reason_codes: ["btc_trend_up"],
      created_at: "2026-06-19T00:00:00.000Z",
      status: "draft"
    });

    expect(result.success).toBe(false);
  });

  it("validates snapshot content and review drafts without exposing raw payloads", () => {
    expect(
      signalSnapshotContentSchema.parse({
        snapshot_id: "snap_2026_06_19_0001",
        evaluated_at: "2026-06-19T00:00:00.000Z",
        schema_version: "phase1.snapshot.v1",
        active_signal_set: validActiveSignalSet,
        input_refs: [
          {
            kind: "market_candle_fact",
            ref: {
              source: "binance_fixture",
              symbol: "BTCUSDT",
              interval: "1d",
              open_time: "2026-06-18T00:00:00.000Z"
            }
          }
        ],
        data_health: "complete"
      })
    ).toMatchObject({ snapshot_id: "snap_2026_06_19_0001" });

    expect(
      reviewDraftSchema.parse({
        review_id: "review_001",
        strategy_id: "core_allocation_lt",
        strategy_version: "v1",
        period_start: "2026-06-19T00:00:00.000Z",
        period_end: "2026-06-20T00:00:00.000Z",
        snapshot_refs: [
          {
            snapshot_id: "snap_2026_06_19_0001",
            created_at: "2026-06-19T00:00:00.000Z",
            schema_version: "phase1.snapshot.v1",
            content_hash: "sha256_fixture_hash"
          }
        ],
        sections: [
          {
            key: "summary",
            title: "Summary",
            body: "Fixture review draft."
          }
        ],
        status: "draft"
      })
    ).toMatchObject({ review_id: "review_001" });
  });
});
