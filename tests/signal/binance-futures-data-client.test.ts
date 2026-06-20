import { describe, expect, it, vi } from "vitest";
import {
  BinanceFuturesDataHttpError,
  createBinanceFuturesDataClient
} from "@/signal/facts/binance-futures-data-client";
import type { MarketDataFactType } from "@/contracts/p15-market-data";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  } as Response;
}

describe("Binance futures data client", () => {
  it("calls the P1.5 public futures-data endpoints without API key headers", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([
        {
          symbol: "BTCUSDT",
          timestamp: 1781913600000,
          longShortRatio: "1.10",
          longAccount: "0.52",
          shortAccount: "0.48"
        }
      ])
    );
    const client = createBinanceFuturesDataClient({
      baseUrl: "https://fapi.binance.com",
      fetchFn: fetchMock
    });
    const cases: Array<[MarketDataFactType, string]> = [
      ["open_interest_hist", "/futures/data/openInterestHist"],
      ["global_long_short_account_ratio", "/futures/data/globalLongShortAccountRatio"],
      ["top_long_short_position_ratio", "/futures/data/topLongShortPositionRatio"],
      ["top_long_short_account_ratio", "/futures/data/topLongShortAccountRatio"]
    ];

    for (const [factType] of cases) {
      await client.fetchFact({
        factType,
        symbol: "BTCUSDT",
        period: "1h",
        limit: 48
      });
    }

    for (const [index, [, expectedPath]] of cases.entries()) {
      const [url, init] = fetchMock.mock.calls[index];
      const parsedUrl = new URL(url as string);

      expect(parsedUrl.origin).toBe("https://fapi.binance.com");
      expect(parsedUrl.pathname).toBe(expectedPath);
      expect(parsedUrl.searchParams.get("symbol")).toBe("BTCUSDT");
      expect(parsedUrl.searchParams.get("period")).toBe("1h");
      expect(parsedUrl.searchParams.get("limit")).toBe("48");
      expect(init).toEqual({ method: "GET" });
    }
  });

  it("throws a typed error for non-2xx Binance responses", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ msg: "restricted location" }, { ok: false, status: 451, statusText: "Unavailable" })
    );
    const client = createBinanceFuturesDataClient({
      baseUrl: "https://fapi.binance.com",
      fetchFn: fetchMock
    });

    await expect(
      client.fetchFact({
        factType: "open_interest_hist",
        symbol: "BTCUSDT",
        period: "1h"
      })
    ).rejects.toMatchObject({
      name: "BinanceFuturesDataHttpError",
      status: 451
    });
    await expect(
      client.fetchFact({
        factType: "open_interest_hist",
        symbol: "BTCUSDT",
        period: "1h"
      })
    ).rejects.toBeInstanceOf(BinanceFuturesDataHttpError);
  });
});
