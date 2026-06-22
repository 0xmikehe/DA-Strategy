import { describe, expect, it } from "vitest";
import { p15MarketDataReadModelSchema } from "@/contracts/p15-market-data.schemas";
import { p15MarketDataHistoryRows } from "@/fixtures/phase1/market-data-history";
import { buildP15MarketDataReadModel } from "@/server/read-model/p15-market-data";

describe("P1.5 market data read model", () => {
  it("summarizes latest, history, and collector health without exposing raw payloads", () => {
    const model = buildP15MarketDataReadModel({
      rows: p15MarketDataHistoryRows,
      generatedAt: new Date("2026-06-20T03:10:00.000Z")
    });

    expect(p15MarketDataReadModelSchema.parse(model)).toEqual(model);
    expect(model.collector_state).toBe("partial");
    expect(model.history).toHaveLength(12);
    expect(model.last_success_at).toBe("2026-06-20T02:03:14.000Z");
    expect(model.metrics).toHaveLength(4);
    expect(model.metrics[0]).toMatchObject({
      fact_type: "open_interest_hist",
      points_24h: 3,
      missing_points_24h: 21,
      state: "partial"
    });
    expect(JSON.stringify(model)).not.toContain("raw_payload");
    expect(JSON.stringify(model)).not.toContain("rawPayload");
  });

  it("falls back to fixture history when the database has not collected rows yet", () => {
    const model = buildP15MarketDataReadModel({
      rows: [],
      fallbackRows: p15MarketDataHistoryRows
    });

    expect(model.history).toHaveLength(12);
    expect(model.selected_symbol).toBe("BTCUSDT");
    expect(model.selected_period).toBe("1h");
  });
});
