import type { MarketDerivedFact as PrismaMarketDerivedFact, PrismaClient } from "@prisma/client";
import type {
  MarketDataCollectorState,
  MarketDataFactRow,
  MarketDataFactType,
  MarketDataMetricSummary,
  P15MarketDataReadModel
} from "@/contracts/p15-market-data";
import { p15MarketDataHistoryRows } from "@/fixtures/phase1/market-data-history";
import { marketDataShadowFactTypes } from "@/signal/facts/collect-shadow-market-data";
import { queryMarketDerivedFacts } from "@/signal/facts/market-derived-facts";

type MarketDerivedFactStore = Pick<PrismaClient, "marketDerivedFact">;

type BuildP15MarketDataReadModelInput = {
  rows: MarketDataFactRow[];
  fallbackRows?: MarketDataFactRow[];
  generatedAt?: Date;
  selectedSymbol?: string;
  selectedPeriod?: string;
  selectedRange?: P15MarketDataReadModel["selected_range"];
};

type GetP15MarketDataReadModelInput = Omit<BuildP15MarketDataReadModelInput, "rows"> & {
  db?: MarketDerivedFactStore;
};

const factLabelByType = {
  open_interest_hist: "Open interest",
  global_long_short_account_ratio: "Global long/short",
  top_long_short_position_ratio: "Top trader positions",
  top_long_short_account_ratio: "Top trader accounts"
} satisfies Record<MarketDataFactType, string>;

const valueLabelByType = {
  open_interest_hist: "OI notional",
  global_long_short_account_ratio: "Global long/short",
  top_long_short_position_ratio: "Top trader positions",
  top_long_short_account_ratio: "Top trader accounts"
} satisfies Record<MarketDataFactType, string>;

export function buildP15MarketDataReadModel(input: BuildP15MarketDataReadModelInput): P15MarketDataReadModel {
  const selectedSymbol = input.selectedSymbol ?? "BTCUSDT";
  const selectedPeriod = input.selectedPeriod ?? "1h";
  const selectedRange = input.selectedRange ?? "24h";
  const usingFallbackRows = input.rows.length === 0 && (input.fallbackRows?.length ?? 0) > 0;
  const sourceRows = input.rows.length > 0 ? input.rows : (input.fallbackRows ?? []);
  const rows = sourceRows
    .filter((row) => row.symbol === selectedSymbol && row.period === selectedPeriod)
    .sort(compareMarketDataRowsDesc);
  const generatedAt = input.generatedAt ?? (usingFallbackRows ? fallbackGeneratedAt(rows) : new Date());
  const history = rows.filter((row) => isWithinSelectedRange(row, generatedAt, selectedRange));
  const metrics = marketDataShadowFactTypes.map((factType) =>
    buildMetric({
      factType,
      rows,
      generatedAt,
      selectedPeriod
    })
  );
  const lastSuccessAt = maxIso(rows.map((row) => row.collected_at));

  return {
    generated_at: generatedAt.toISOString(),
    source: "binance_usds_futures",
    mode: "shadow",
    symbols: sortedUnique([selectedSymbol, ...sourceRows.map((row) => row.symbol)]),
    periods: sortedUnique([selectedPeriod, ...sourceRows.map((row) => row.period)]),
    selected_symbol: selectedSymbol,
    selected_period: selectedPeriod,
    selected_range: selectedRange,
    collector_state: summarizeCollectorState(metrics),
    last_success_at: lastSuccessAt,
    metrics,
    history
  };
}

export async function getP15MarketDataReadModel(
  input: GetP15MarketDataReadModelInput = {}
): Promise<P15MarketDataReadModel> {
  const selectedSymbol = input.selectedSymbol ?? "BTCUSDT";
  const selectedPeriod = input.selectedPeriod ?? "1h";
  const db = input.db ?? (await import("@/server/db/prisma")).prisma;
  const dbRows = await queryMarketDerivedFacts(db, {
    symbol: selectedSymbol,
    period: selectedPeriod,
    take: 720
  });

  return buildP15MarketDataReadModel({
    rows: dbRows.map(toMarketDataFactRow),
    fallbackRows: input.fallbackRows ?? p15MarketDataHistoryRows,
    generatedAt: input.generatedAt,
    selectedSymbol,
    selectedPeriod,
    selectedRange: input.selectedRange
  });
}

function buildMetric(input: {
  factType: MarketDataFactType;
  rows: MarketDataFactRow[];
  generatedAt: Date;
  selectedPeriod: string;
}): MarketDataMetricSummary {
  const rowsForFact = input.rows.filter((row) => row.fact_type === input.factType);
  const latest = rowsForFact[0];
  const points24h = countRowsSince(rowsForFact, addMinutes(input.generatedAt, -24 * 60), input.generatedAt);
  const points7d = countRowsSince(rowsForFact, addMinutes(input.generatedAt, -7 * 24 * 60), input.generatedAt);
  const expected24h = expectedPoints24h(input.selectedPeriod);
  const missing24h = Math.max(0, expected24h - points24h);
  const latestLagMinutes = latest
    ? Math.max(0, Math.floor((input.generatedAt.getTime() - Date.parse(latest.event_time)) / 60000))
    : undefined;

  return {
    fact_type: input.factType,
    label: factLabelByType[input.factType],
    latest,
    latest_lag_minutes: latestLagMinutes,
    points_24h: points24h,
    points_7d: points7d,
    missing_points_24h: missing24h,
    state: metricState({
      latestLagMinutes,
      missing24h,
      selectedPeriod: input.selectedPeriod
    })
  };
}

function toMarketDataFactRow(row: PrismaMarketDerivedFact): MarketDataFactRow {
  const factType = row.factType as MarketDataFactType;

  return {
    id: row.id,
    source: "binance_usds_futures",
    fact_type: factType,
    symbol: row.symbol,
    period: row.period,
    event_time: row.eventTime.toISOString(),
    collected_at: row.collectedAt.toISOString(),
    value_label: valueLabelByType[factType],
    primary_value: primaryValue(row, factType),
    secondary_value: secondaryValue(row, factType),
    content_hash: row.contentHash
  };
}

function primaryValue(row: PrismaMarketDerivedFact, factType: MarketDataFactType) {
  if (factType === "open_interest_hist") {
    return decimalToString(row.sumOpenInterestValue ?? row.sumOpenInterest);
  }

  return decimalToString(row.longShortRatio);
}

function secondaryValue(row: PrismaMarketDerivedFact, factType: MarketDataFactType) {
  if (factType === "open_interest_hist") {
    return optionalDecimalToString(row.sumOpenInterest);
  }

  return optionalDecimalToString(row.longRatio);
}

function metricState(input: {
  latestLagMinutes?: number;
  missing24h: number;
  selectedPeriod: string;
}): MarketDataCollectorState {
  if (input.latestLagMinutes === undefined) {
    return "empty";
  }

  if (input.latestLagMinutes > periodMinutes(input.selectedPeriod) * 2) {
    return "stale";
  }

  if (input.missing24h > 0) {
    return "partial";
  }

  return "shadow_collecting";
}

function summarizeCollectorState(metrics: MarketDataMetricSummary[]): MarketDataCollectorState {
  if (metrics.every((metric) => metric.state === "empty")) {
    return "empty";
  }

  if (metrics.some((metric) => metric.state === "stale")) {
    return "stale";
  }

  if (metrics.some((metric) => metric.state === "empty" || metric.state === "partial")) {
    return "partial";
  }

  return "shadow_collecting";
}

function compareMarketDataRowsDesc(left: MarketDataFactRow, right: MarketDataFactRow) {
  const byTime = Date.parse(right.event_time) - Date.parse(left.event_time);

  if (byTime !== 0) {
    return byTime;
  }

  return left.fact_type.localeCompare(right.fact_type);
}

function isWithinSelectedRange(
  row: MarketDataFactRow,
  generatedAt: Date,
  selectedRange: P15MarketDataReadModel["selected_range"]
) {
  const rangeMinutes = selectedRange === "24h" ? 24 * 60 : selectedRange === "7d" ? 7 * 24 * 60 : 30 * 24 * 60;
  return Date.parse(row.event_time) >= addMinutes(generatedAt, -rangeMinutes).getTime();
}

function countRowsSince(rows: MarketDataFactRow[], from: Date, to: Date) {
  return rows.filter((row) => {
    const eventTime = Date.parse(row.event_time);
    return eventTime >= from.getTime() && eventTime <= to.getTime();
  }).length;
}

function expectedPoints24h(period: string) {
  return Math.ceil((24 * 60) / periodMinutes(period));
}

function periodMinutes(period: string) {
  const match = /^(\d+)([mhd])$/.exec(period);

  if (!match) {
    return 60;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === "m") {
    return value;
  }

  if (unit === "h") {
    return value * 60;
  }

  return value * 24 * 60;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function fallbackGeneratedAt(rows: MarketDataFactRow[]) {
  const latestCollectedAt = maxIso(rows.map((row) => row.collected_at));
  return latestCollectedAt ? addMinutes(new Date(latestCollectedAt), 1) : new Date();
}

function decimalToString(value: PrismaMarketDerivedFact["sumOpenInterest"]) {
  return value?.toString() ?? "0";
}

function optionalDecimalToString(value: PrismaMarketDerivedFact["sumOpenInterest"]) {
  return value?.toString();
}

function maxIso(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => value !== undefined)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
