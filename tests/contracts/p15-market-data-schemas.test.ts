import { describe, expect, it } from "vitest";
import {
  marketDataFactRowSchema,
  p15MarketDataReadModelSchema
} from "@/contracts/p15-market-data.schemas";
import { p15MarketDataHistoryRows } from "@/fixtures/phase1/market-data-history";

describe("P1.5 market data runtime schemas", () => {
  it("accepts deterministic market data history fixture rows", () => {
    expect(p15MarketDataHistoryRows.length).toBeGreaterThanOrEqual(8);

    for (const row of p15MarketDataHistoryRows) {
      expect(marketDataFactRowSchema.parse(row)).toMatchObject({
        source: "binance_usds_futures",
        symbol: "BTCUSDT",
        period: "1h"
      });
    }
  });

  it("rejects fact types outside the P1.5 shadow collector contract", () => {
    const result = marketDataFactRowSchema.safeParse({
      ...p15MarketDataHistoryRows[0],
      fact_type: "taker_buy_sell_volume"
    });

    expect(result.success).toBe(false);
  });

  it("rejects raw payload keys at the frontend read-model boundary", () => {
    const result = marketDataFactRowSchema.safeParse({
      ...p15MarketDataHistoryRows[0],
      raw_payload: {
        timestamp: 1781913600000
      }
    });

    expect(result.success).toBe(false);
  });

  it("parses a shadow read model with latest and historical rows", () => {
    const readModel = p15MarketDataReadModelSchema.parse({
      generated_at: "2026-06-20T03:05:00.000Z",
      source: "binance_usds_futures",
      mode: "shadow",
      symbols: ["BTCUSDT"],
      periods: ["1h"],
      selected_symbol: "BTCUSDT",
      selected_period: "1h",
      selected_range: "24h",
      collector_state: "shadow_collecting",
      last_success_at: "2026-06-20T03:01:00.000Z",
      metrics: [
        {
          fact_type: "open_interest_hist",
          label: "Open Interest",
          latest: p15MarketDataHistoryRows[0],
          latest_lag_minutes: 5,
          points_24h: 3,
          points_7d: 3,
          missing_points_24h: 21,
          state: "shadow_collecting"
        }
      ],
      history: p15MarketDataHistoryRows
    });

    expect(readModel.mode).toBe("shadow");
    expect(JSON.stringify(readModel)).not.toContain("raw_payload");
    expect(JSON.stringify(readModel)).not.toContain("rawPayload");
  });
});
