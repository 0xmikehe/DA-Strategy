import { describe, expect, it, vi } from "vitest";
import { jobTypes } from "@/server/jobs/types";
import { marketDataShadowFactTypes } from "@/signal/facts/collect-shadow-market-data";
import { runWorkerCommand, runWorkerSmoke } from "@/server/worker";

describe("worker smoke", () => {
  it("reports the P0 worker job types without contacting external services", async () => {
    const result = await runWorkerSmoke();

    expect(result).toEqual({
      status: "ok",
      mode: "smoke",
      job_types: jobTypes
    });
  });

  it("skips shadow market data collection unless the env flag is explicitly enabled", async () => {
    const result = await runWorkerCommand(["--once", "--collect-market-data"], {
      env: serverEnv({ MARKET_DATA_SHADOW_ENABLED: false })
    });

    expect(result).toEqual({
      status: "skipped",
      mode: "collect-market-data",
      reason: "MARKET_DATA_SHADOW_ENABLED=false"
    });
  });

  it("runs shadow market data collection with env-scoped symbols and defaults", async () => {
    const collectMarketData = vi.fn(async () => ({
      status: "succeeded" as const,
      fetched: 4,
      stored: 4,
      failed: []
    }));

    const result = await runWorkerCommand(["--once", "--collect-market-data"], {
      env: serverEnv({
        MARKET_DATA_SHADOW_ENABLED: true,
        MARKET_DATA_SHADOW_SYMBOLS: ["BTCUSDT", "ETHUSDT"],
        MARKET_DATA_SHADOW_PERIOD: "1h",
        MARKET_DATA_SHADOW_LIMIT: 48
      }),
      collectMarketData
    });

    expect(collectMarketData).toHaveBeenCalledWith({
      symbols: ["BTCUSDT", "ETHUSDT"],
      period: "1h",
      limit: 48,
      factTypes: marketDataShadowFactTypes
    });
    expect(result).toEqual({
      status: "succeeded",
      fetched: 4,
      stored: 4,
      failed: []
    });
  });
});

function serverEnv(overrides: Partial<ReturnType<typeof baseServerEnv>>) {
  return {
    ...baseServerEnv(),
    ...overrides
  };
}

function baseServerEnv() {
  return {
    DATABASE_URL: "postgresql://digital_asset:local_password@localhost:55432/digital_asset?schema=public",
    BINANCE_FAPI_BASE_URL: "https://fapi.binance.com",
    MARKET_DATA_SHADOW_ENABLED: false,
    MARKET_DATA_SHADOW_SYMBOLS: ["BTCUSDT"],
    MARKET_DATA_SHADOW_PERIOD: "1h",
    MARKET_DATA_SHADOW_LIMIT: 48
  };
}
