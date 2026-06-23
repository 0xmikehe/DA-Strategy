import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  normalizeMarketDerivedFact,
  queryMarketDerivedFacts,
  upsertMarketDerivedFacts
} from "@/signal/facts/market-derived-facts";

const testSource = "binance_usds_futures_test";

beforeEach(async () => {
  await prisma.marketDerivedFact.deleteMany({
    where: {
      source: testSource
    }
  });
});

afterEach(async () => {
  await prisma.marketDerivedFact.deleteMany({
    where: {
      source: testSource
    }
  });
});

describe("market derived facts", () => {
  it("normalizes open interest payloads with market timestamp and stable content hash", () => {
    const normalized = normalizeMarketDerivedFact({
      source: testSource,
      factType: "open_interest_hist",
      symbol: "BTCUSDT",
      period: "1h",
      collectedAt: new Date("2026-06-20T00:03:00.000Z"),
      rawPayload: {
        symbol: "BTCUSDT",
        sumOpenInterest: "62000.125",
        sumOpenInterestValue: "4300000000.50",
        CMCCirculatingSupply: "19000000",
        timestamp: Date.parse("2026-06-20T00:00:00.000Z")
      }
    });

    expect(normalized).toMatchObject({
      source: testSource,
      factType: "open_interest_hist",
      symbol: "BTCUSDT",
      period: "1h",
      sumOpenInterest: "62000.125",
      sumOpenInterestValue: "4300000000.50",
      cmcCirculatingSupply: "19000000"
    });
    expect(normalized.eventTime.toISOString()).toBe("2026-06-20T00:00:00.000Z");
    expect(normalized.collectedAt.toISOString()).toBe("2026-06-20T00:03:00.000Z");
    expect(normalized.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes long-short ratio payloads into decimal strings", () => {
    const normalized = normalizeMarketDerivedFact({
      source: testSource,
      factType: "global_long_short_account_ratio",
      symbol: "BTCUSDT",
      period: "1h",
      collectedAt: new Date("2026-06-20T00:03:00.000Z"),
      rawPayload: {
        symbol: "BTCUSDT",
        longShortRatio: "1.2345",
        longAccount: "0.5522",
        shortAccount: "0.4478",
        timestamp: Date.parse("2026-06-20T00:00:00.000Z")
      }
    });

    expect(normalized.longShortRatio).toBe("1.2345");
    expect(normalized.longRatio).toBe("0.5522");
    expect(normalized.shortRatio).toBe("0.4478");
  });

  it("upserts repeated market timestamps idempotently while preserving first collected_at", async () => {
    const first = normalizeMarketDerivedFact({
      source: testSource,
      factType: "global_long_short_account_ratio",
      symbol: "BTCUSDT",
      period: "1h",
      collectedAt: new Date("2026-06-20T00:03:00.000Z"),
      rawPayload: {
        symbol: "BTCUSDT",
        longShortRatio: "1.10",
        longAccount: "0.5238",
        shortAccount: "0.4762",
        timestamp: Date.parse("2026-06-20T00:00:00.000Z")
      }
    });
    const revised = normalizeMarketDerivedFact({
      source: testSource,
      factType: "global_long_short_account_ratio",
      symbol: "BTCUSDT",
      period: "1h",
      collectedAt: new Date("2026-06-20T00:10:00.000Z"),
      rawPayload: {
        symbol: "BTCUSDT",
        longShortRatio: "1.20",
        longAccount: "0.5455",
        shortAccount: "0.4545",
        timestamp: Date.parse("2026-06-20T00:00:00.000Z")
      }
    });

    await upsertMarketDerivedFacts(prisma, [first]);
    await upsertMarketDerivedFacts(prisma, [revised]);

    const rows = await queryMarketDerivedFacts(prisma, {
      source: testSource,
      symbol: "BTCUSDT",
      period: "1h",
      factType: "global_long_short_account_ratio"
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].collectedAt.toISOString()).toBe("2026-06-20T00:03:00.000Z");
    expect(rows[0].longShortRatio?.toString()).toBe("1.2");
  });

  it("filters historical queries by knownAt to prevent future leakage", async () => {
    const early = normalizeMarketDerivedFact({
      source: testSource,
      factType: "open_interest_hist",
      symbol: "BTCUSDT",
      period: "1h",
      collectedAt: new Date("2026-06-20T00:03:00.000Z"),
      rawPayload: {
        symbol: "BTCUSDT",
        sumOpenInterest: "62000",
        sumOpenInterestValue: "4300000000",
        timestamp: Date.parse("2026-06-20T00:00:00.000Z")
      }
    });
    const late = normalizeMarketDerivedFact({
      source: testSource,
      factType: "open_interest_hist",
      symbol: "BTCUSDT",
      period: "1h",
      collectedAt: new Date("2026-06-20T01:03:00.000Z"),
      rawPayload: {
        symbol: "BTCUSDT",
        sumOpenInterest: "62100",
        sumOpenInterestValue: "4310000000",
        timestamp: Date.parse("2026-06-20T01:00:00.000Z")
      }
    });

    await upsertMarketDerivedFacts(prisma, [early, late]);

    const rows = await queryMarketDerivedFacts(prisma, {
      source: testSource,
      symbol: "BTCUSDT",
      period: "1h",
      factType: "open_interest_hist",
      knownAt: new Date("2026-06-20T00:30:00.000Z")
    });

    expect(rows.map((row) => row.eventTime.toISOString())).toEqual(["2026-06-20T00:00:00.000Z"]);
  });
});
