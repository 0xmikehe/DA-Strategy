import type { DecimalString, IsoDateTimeString } from "./phase1";

export type MarketDataFactType =
  | "open_interest_hist"
  | "global_long_short_account_ratio"
  | "top_long_short_position_ratio"
  | "top_long_short_account_ratio";

export type MarketDataCollectorState =
  | "shadow_collecting"
  | "partial"
  | "stale"
  | "empty"
  | "blocked";

export type MarketDataFactRow = {
  id: string;
  source: "binance_usds_futures";
  fact_type: MarketDataFactType;
  symbol: string;
  period: string;
  event_time: IsoDateTimeString;
  collected_at: IsoDateTimeString;
  value_label: string;
  primary_value: DecimalString;
  secondary_value?: DecimalString;
  content_hash: string;
};

export type MarketDataMetricSummary = {
  fact_type: MarketDataFactType;
  label: string;
  latest?: MarketDataFactRow;
  latest_lag_minutes?: number;
  points_24h: number;
  points_7d: number;
  missing_points_24h: number;
  state: MarketDataCollectorState;
};

export type P15MarketDataReadModel = {
  generated_at: IsoDateTimeString;
  source: "binance_usds_futures";
  mode: "shadow";
  symbols: string[];
  periods: string[];
  selected_symbol: string;
  selected_period: string;
  selected_range: "24h" | "7d" | "30d";
  collector_state: MarketDataCollectorState;
  last_success_at?: IsoDateTimeString;
  metrics: MarketDataMetricSummary[];
  history: MarketDataFactRow[];
};
