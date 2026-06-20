import { z } from "zod";
import { type EnvMap, type LoadLocalEnvOptions, loadLocalEnv } from "./local-env-loader";

const ServerEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BINANCE_FAPI_BASE_URL: z.string().url().default("https://fapi.binance.com"),
  MARKET_DATA_SHADOW_ENABLED: z
    .preprocess((value) => {
      if (typeof value !== "string") {
        return value;
      }

      return value.trim().toLowerCase() === "true";
    }, z.boolean())
    .default(false),
  MARKET_DATA_SHADOW_SYMBOLS: z
    .preprocess((value) => {
      if (typeof value !== "string") {
        return value;
      }

      return value
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);
    }, z.array(z.string().min(1)))
    .default(["BTCUSDT"]),
  MARKET_DATA_SHADOW_PERIOD: z.string().min(1).default("1h"),
  MARKET_DATA_SHADOW_LIMIT: z.coerce.number().int().positive().default(48)
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export type GetServerEnvOptions = LoadLocalEnvOptions;

export function parseServerEnv(env: EnvMap = process.env): ServerEnv {
  return ServerEnvSchema.parse(env);
}

export function getServerEnv(options: GetServerEnvOptions = {}): ServerEnv {
  const env = options.env ?? process.env;
  loadLocalEnv({ ...options, env });
  return parseServerEnv(env);
}
