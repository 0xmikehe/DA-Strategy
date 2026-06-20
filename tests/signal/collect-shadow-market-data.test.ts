import { describe, expect, it, vi } from "vitest";
import type { MarketDataFactType } from "@/contracts/p15-market-data";
import {
  collectShadowMarketData,
  marketDataShadowFactTypes
} from "@/signal/facts/collect-shadow-market-data";
import type { NormalizedMarketDerivedFact } from "@/signal/facts/market-derived-facts";

const collectedAt = new Date("2026-06-20T00:03:00.000Z");

describe("shadow market data collector", () => {
  it("fetches and stores the four P1.5 Binance public data facts", async () => {
    const fetchFact = vi.fn(async ({ factType }: { factType: MarketDataFactType }) => [
      payloadFor(factType, Date.parse("2026-06-20T00:00:00.000Z"))
    ]);
    const storeFacts = vi.fn(async (facts: NormalizedMarketDerivedFact[]) =>
      facts.map((fact, index) => ({ ...fact, id: `stored_${index}` }))
    );

    const result = await collectShadowMarketData(
      {
        symbols: ["BTCUSDT"],
        period: "1h",
        limit: 48
      },
      {
        client: { fetchFact },
        storeFacts,
        now: () => collectedAt
      }
    );

    expect(fetchFact).toHaveBeenCalledTimes(4);
    expect(fetchFact.mock.calls.map(([request]) => request)).toEqual(
      marketDataShadowFactTypes.map((factType) => ({
        factType,
        symbol: "BTCUSDT",
        period: "1h",
        limit: 48
      }))
    );
    expect(storeFacts).toHaveBeenCalledTimes(1);
    const storedFacts = storeFacts.mock.calls[0][0] as NormalizedMarketDerivedFact[];
    expect(storedFacts).toHaveLength(4);
    expect(storedFacts[0]).toMatchObject({
      factType: "open_interest_hist",
      symbol: "BTCUSDT",
      period: "1h",
      collectedAt
    });
    expect(result).toEqual({
      status: "succeeded",
      fetched: 4,
      stored: 4,
      failed: []
    });
  });

  it("stores successful facts when one endpoint fails", async () => {
    const fetchFact = vi.fn(async ({ factType }: { factType: MarketDataFactType }) => {
      if (factType === "top_long_short_position_ratio") {
        throw new Error("temporary 5xx");
      }

      return [payloadFor(factType, Date.parse("2026-06-20T00:00:00.000Z"))];
    });
    const storeFacts = vi.fn(async (facts: NormalizedMarketDerivedFact[]) => facts);

    const result = await collectShadowMarketData(
      {
        symbols: ["BTCUSDT"],
        period: "1h",
        limit: 48
      },
      {
        client: { fetchFact },
        storeFacts,
        now: () => collectedAt
      }
    );

    expect(storeFacts).toHaveBeenCalledTimes(1);
    const storedFacts = storeFacts.mock.calls[0][0] as NormalizedMarketDerivedFact[];
    expect(storedFacts.map((fact) => fact.factType)).toEqual([
      "open_interest_hist",
      "global_long_short_account_ratio",
      "top_long_short_account_ratio"
    ]);
    expect(result).toEqual({
      status: "failed",
      fetched: 3,
      stored: 3,
      failed: [
        {
          fact_type: "top_long_short_position_ratio",
          symbol: "BTCUSDT",
          message: "temporary 5xx"
        }
      ]
    });
  });
});

function payloadFor(factType: MarketDataFactType, timestamp: number) {
  if (factType === "open_interest_hist") {
    return {
      symbol: "BTCUSDT",
      sumOpenInterest: "62000.125",
      sumOpenInterestValue: "4300000000.50",
      CMCCirculatingSupply: "19000000",
      timestamp
    };
  }

  return {
    symbol: "BTCUSDT",
    longShortRatio: "1.2345",
    longAccount: "0.5522",
    shortAccount: "0.4478",
    timestamp
  };
}
