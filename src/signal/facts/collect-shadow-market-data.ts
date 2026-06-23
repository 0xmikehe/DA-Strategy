import type { MarketDataFactType } from "@/contracts/p15-market-data";
import type { BinanceFuturesDataRequest } from "./binance-futures-data-client";
import {
  type NormalizedMarketDerivedFact,
  normalizeMarketDerivedFact
} from "./market-derived-facts";

export const marketDataShadowFactTypes = [
  "open_interest_hist",
  "global_long_short_account_ratio",
  "top_long_short_position_ratio",
  "top_long_short_account_ratio"
] as const satisfies readonly MarketDataFactType[];

export type ShadowMarketDataCollectorConfig = {
  symbols: string[];
  period: string;
  limit: number;
  factTypes?: readonly MarketDataFactType[];
};

export type ShadowMarketDataCollectorDeps = {
  client: {
    fetchFact(request: BinanceFuturesDataRequest): Promise<unknown[]>;
  };
  storeFacts(facts: NormalizedMarketDerivedFact[]): Promise<unknown[]>;
  now?: () => Date;
};

export type ShadowMarketDataCollectionResult = {
  status: "succeeded" | "failed";
  fetched: number;
  stored: number;
  failed: Array<{
    fact_type: MarketDataFactType;
    symbol: string;
    message: string;
  }>;
};

export async function collectShadowMarketData(
  config: ShadowMarketDataCollectorConfig,
  deps: ShadowMarketDataCollectorDeps
): Promise<ShadowMarketDataCollectionResult> {
  const factTypes = config.factTypes ?? marketDataShadowFactTypes;
  const now = deps.now ?? (() => new Date());
  const facts: NormalizedMarketDerivedFact[] = [];
  const failed: ShadowMarketDataCollectionResult["failed"] = [];
  let fetched = 0;

  for (const symbol of config.symbols) {
    for (const factType of factTypes) {
      try {
        const payloads = await deps.client.fetchFact({
          factType,
          symbol,
          period: config.period,
          limit: config.limit
        });

        fetched += payloads.length;
        facts.push(
          ...payloads.map((rawPayload) =>
            normalizeMarketDerivedFact({
              factType,
              symbol,
              period: config.period,
              collectedAt: now(),
              rawPayload: toRecord(rawPayload)
            })
          )
        );
      } catch (error) {
        failed.push({
          fact_type: factType,
          symbol,
          message: errorMessage(error)
        });
      }
    }
  }

  const storedRows = facts.length > 0 ? await deps.storeFacts(facts) : [];

  return {
    status: failed.length > 0 ? "failed" : "succeeded",
    fetched,
    stored: storedRows.length,
    failed
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Binance futures data payload must be an object");
  }

  return value as Record<string, unknown>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
