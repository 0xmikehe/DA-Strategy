import { pathToFileURL } from "node:url";
import { type ServerEnv, getServerEnv } from "../config/env";
import { jobTypes } from "../jobs/types";
import {
  type ShadowMarketDataCollectionResult,
  type ShadowMarketDataCollectorConfig,
  collectShadowMarketData,
  marketDataShadowFactTypes
} from "@/signal/facts/collect-shadow-market-data";

export type WorkerSmokeResult = {
  status: "ok";
  mode: "smoke";
  job_types: typeof jobTypes;
};

export type WorkerIdleResult = {
  status: "idle";
  mode: "once" | "daemon";
  job_types: typeof jobTypes;
};

export type WorkerSkippedResult = {
  status: "skipped";
  mode: "collect-market-data";
  reason: string;
};

export type WorkerCommandResult = WorkerSmokeResult | WorkerIdleResult | WorkerSkippedResult | ShadowMarketDataCollectionResult;

export type WorkerCommandOptions = {
  env?: ServerEnv;
  collectMarketData?: (config: ShadowMarketDataCollectorConfig) => Promise<ShadowMarketDataCollectionResult>;
};

export async function runWorkerSmoke(): Promise<WorkerSmokeResult> {
  return {
    status: "ok",
    mode: "smoke",
    job_types: jobTypes
  };
}

export async function runWorkerCommand(args: string[], options: WorkerCommandOptions = {}): Promise<WorkerCommandResult> {
  if (args.includes("--smoke")) {
    return runWorkerSmoke();
  }

  const env = options.env ?? getServerEnv();

  if (args.includes("--collect-market-data")) {
    if (!env.MARKET_DATA_SHADOW_ENABLED) {
      return {
        status: "skipped",
        mode: "collect-market-data",
        reason: "MARKET_DATA_SHADOW_ENABLED=false"
      };
    }

    const collectMarketData = options.collectMarketData ?? collectMarketDataFromEnv;
    return collectMarketData({
      symbols: env.MARKET_DATA_SHADOW_SYMBOLS,
      period: env.MARKET_DATA_SHADOW_PERIOD,
      limit: env.MARKET_DATA_SHADOW_LIMIT,
      factTypes: marketDataShadowFactTypes
    });
  }

  return {
    status: "idle",
    mode: args.includes("--once") ? "once" : "daemon",
    job_types: jobTypes
  };
}

async function collectMarketDataFromEnv(
  config: ShadowMarketDataCollectorConfig
): Promise<ShadowMarketDataCollectionResult> {
  const env = getServerEnv();
  const [{ createBinanceFuturesDataClient }, { upsertMarketDerivedFacts }, { prisma }] = await Promise.all([
    import("@/signal/facts/binance-futures-data-client"),
    import("@/signal/facts/market-derived-facts"),
    import("@/server/db/prisma")
  ]);

  return collectShadowMarketData(config, {
    client: createBinanceFuturesDataClient({
      baseUrl: env.BINANCE_FAPI_BASE_URL
    }),
    storeFacts: (facts) => upsertMarketDerivedFacts(prisma, facts)
  });
}

async function main() {
  const args = process.argv.slice(2);
  console.log(JSON.stringify(await runWorkerCommand(args)));
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
