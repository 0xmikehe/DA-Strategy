import { createHash } from "node:crypto";
import type {
  ActiveSignal,
  SignalSnapshotContent,
  SignalSnapshotRef
} from "@/contracts/phase1";
import {
  signalSnapshotContentSchema,
  signalSnapshotRefSchema
} from "@/contracts/phase1.schemas";

export type MarketCandleFactInput = {
  source: string;
  symbol: string;
  interval: string;
  open_time: string;
  close_time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  raw_payload: unknown;
};

export type FundingRateFactInput = {
  source: string;
  symbol: string;
  funding_time: string;
  funding_rate: string;
  mark_price?: string | null;
  raw_payload: unknown;
};

export type BuildSignalSnapshotInput = {
  snapshot_id: string;
  evaluated_at: string;
  schema_version: string;
  market_candles: readonly MarketCandleFactInput[];
  funding_rates: readonly FundingRateFactInput[];
};

export type BuiltSignalSnapshot = {
  content: SignalSnapshotContent;
  ref: SignalSnapshotRef;
};

const DECIMAL_SCALE = 100000000n;

export function buildSignalSnapshot(input: BuildSignalSnapshotInput): BuiltSignalSnapshot {
  const btcCandles = latestTwoCandles(input.market_candles, "BTCUSDT");
  const ethBtcCandles = latestTwoCandles(input.market_candles, "ETHBTC");
  const fundingRate = latestFundingRate(input.funding_rates, "BTCUSDT");

  const activeSignalSet = {
    snapshot_id: input.snapshot_id,
    as_of: input.evaluated_at,
    data_health: btcCandles && ethBtcCandles && fundingRate ? "complete" : "partial",
    signals: [
      buildRiskRegimeSignal(input.evaluated_at, btcCandles),
      buildCoreTiltSignal(input.evaluated_at, ethBtcCandles),
      buildFundingSentimentSignal(input.evaluated_at, fundingRate)
    ].filter((signal): signal is ActiveSignal => signal !== null)
  } satisfies SignalSnapshotContent["active_signal_set"];

  const content = signalSnapshotContentSchema.parse({
    snapshot_id: input.snapshot_id,
    evaluated_at: input.evaluated_at,
    schema_version: input.schema_version,
    active_signal_set: activeSignalSet,
    input_refs: [
      ...input.market_candles.map((fact) => ({
        kind: "market_candle_fact" as const,
        ref: {
          source: fact.source,
          symbol: fact.symbol,
          interval: fact.interval,
          open_time: fact.open_time
        }
      })),
      ...input.funding_rates.map((fact) => ({
        kind: "funding_rate_fact" as const,
        ref: {
          source: fact.source,
          symbol: fact.symbol,
          funding_time: fact.funding_time
        }
      }))
    ],
    data_health: activeSignalSet.data_health
  });

  const ref = signalSnapshotRefSchema.parse({
    snapshot_id: content.snapshot_id,
    created_at: input.evaluated_at,
    schema_version: input.schema_version,
    content_hash: hashCanonicalJson(content)
  });

  return { content, ref };
}

function latestTwoCandles(
  facts: readonly MarketCandleFactInput[],
  symbol: string
): readonly [MarketCandleFactInput, MarketCandleFactInput] | null {
  const matching = facts
    .filter((fact) => fact.symbol === symbol)
    .sort((left, right) => left.open_time.localeCompare(right.open_time));

  if (matching.length < 2) {
    return null;
  }

  return [matching[matching.length - 2], matching[matching.length - 1]];
}

function latestFundingRate(
  facts: readonly FundingRateFactInput[],
  symbol: string
): FundingRateFactInput | null {
  const matching = facts
    .filter((fact) => fact.symbol === symbol)
    .sort((left, right) => left.funding_time.localeCompare(right.funding_time));

  return matching.at(-1) ?? null;
}

function buildRiskRegimeSignal(
  evaluatedAt: string,
  candles: readonly [MarketCandleFactInput, MarketCandleFactInput] | null
): ActiveSignal | null {
  if (!candles) {
    return null;
  }

  const change = decimalSubtract(candles[1].close, candles[0].close);
  const isUp = parseDecimalString(change) > 0n;

  return {
    signal_id: "risk_regime",
    signal_version: "v1",
    lifecycle_state: "enabled",
    value: isUp ? "risk_on" : "risk_off",
    raw_value: `btc_close_change=${change}`,
    evaluated_at: evaluatedAt,
    reason_codes: [isUp ? "btc_close_above_previous" : "btc_close_below_previous"]
  };
}

function buildCoreTiltSignal(
  evaluatedAt: string,
  candles: readonly [MarketCandleFactInput, MarketCandleFactInput] | null
): ActiveSignal | null {
  if (!candles) {
    return null;
  }

  const change = decimalSubtract(candles[1].close, candles[0].close);
  const ethOutperforming = parseDecimalString(change) > 0n;

  return {
    signal_id: "core_tilt",
    signal_version: "v1",
    lifecycle_state: "enabled",
    value: ethOutperforming ? "eth_outperforming" : "btc_outperforming",
    raw_value: `ethbtc_close_change=${change}`,
    evaluated_at: evaluatedAt,
    reason_codes: [ethOutperforming ? "ethbtc_close_above_previous" : "ethbtc_close_below_previous"]
  };
}

function buildFundingSentimentSignal(
  evaluatedAt: string,
  fundingRate: FundingRateFactInput | null
): ActiveSignal | null {
  if (!fundingRate) {
    return null;
  }

  const rate = parseDecimalString(fundingRate.funding_rate);
  const overheatedThreshold = parseDecimalString("0.00100000");
  const value = rate > overheatedThreshold ? "overheated" : "neutral";

  return {
    signal_id: "funding_sentiment",
    signal_version: "v1",
    lifecycle_state: "enabled",
    value,
    raw_value: fundingRate.funding_rate,
    evaluated_at: evaluatedAt,
    reason_codes: [value === "neutral" ? "funding_rate_neutral" : "funding_rate_overheated"]
  };
}

function decimalSubtract(left: string, right: string): string {
  return formatDecimalString(parseDecimalString(left) - parseDecimalString(right));
}

function parseDecimalString(value: string): bigint {
  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.replace(/^-/, "");
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const paddedFraction = fractionPart.padEnd(8, "0").slice(0, 8);

  return sign * (BigInt(integerPart) * DECIMAL_SCALE + BigInt(paddedFraction));
}

function formatDecimalString(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const integerPart = absolute / DECIMAL_SCALE;
  const fractionPart = (absolute % DECIMAL_SCALE).toString().padStart(8, "0");

  return `${sign}${integerPart}.${fractionPart}`;
}

function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(sortJson(value))).digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)])
    );
  }

  return value;
}
