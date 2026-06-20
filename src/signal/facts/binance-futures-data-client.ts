import type { MarketDataFactType } from "@/contracts/p15-market-data";

export type BinanceFuturesDataRequest = {
  factType: MarketDataFactType;
  symbol: string;
  period: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
};

export type BinanceFuturesDataClientOptions = {
  baseUrl: string;
  fetchFn?: typeof fetch;
};

const endpointByFactType = {
  open_interest_hist: "/futures/data/openInterestHist",
  global_long_short_account_ratio: "/futures/data/globalLongShortAccountRatio",
  top_long_short_position_ratio: "/futures/data/topLongShortPositionRatio",
  top_long_short_account_ratio: "/futures/data/topLongShortAccountRatio"
} satisfies Record<MarketDataFactType, string>;

export class BinanceFuturesDataHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly responseBody: string;

  constructor(input: { status: number; statusText: string; url: string; responseBody: string }) {
    super(`Binance futures data request failed with HTTP ${input.status}: ${input.statusText}`);
    this.name = "BinanceFuturesDataHttpError";
    this.status = input.status;
    this.statusText = input.statusText;
    this.url = input.url;
    this.responseBody = input.responseBody;
  }
}

export function createBinanceFuturesDataClient(options: BinanceFuturesDataClientOptions) {
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async fetchFact(request: BinanceFuturesDataRequest): Promise<unknown[]> {
      const url = buildFuturesDataUrl(options.baseUrl, request);
      const response = await fetchFn(url, { method: "GET" });

      if (!response.ok) {
        throw new BinanceFuturesDataHttpError({
          status: response.status,
          statusText: response.statusText,
          url,
          responseBody: await response.text()
        });
      }

      const payload = await response.json();
      return Array.isArray(payload) ? payload : [payload];
    }
  };
}

function buildFuturesDataUrl(baseUrl: string, request: BinanceFuturesDataRequest) {
  const url = new URL(endpointByFactType[request.factType], baseUrl);
  url.searchParams.set("symbol", request.symbol);
  url.searchParams.set("period", request.period);

  if (request.limit !== undefined) {
    url.searchParams.set("limit", request.limit.toString());
  }

  if (request.startTime !== undefined) {
    url.searchParams.set("startTime", request.startTime.toString());
  }

  if (request.endTime !== undefined) {
    url.searchParams.set("endTime", request.endTime.toString());
  }

  return url.toString();
}
