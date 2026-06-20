# P1.5 Market Data Contract

> 本文是 ADR-0009 的实现伴随文档，定义 P1.5 Binance public futures-data shadow collector 的数据契约、字段映射、read model 和 replay 语义。数据库 ER delta 见 `docs/api/p1-er.md` §4.2 与 §6.2。

## 1. 范围

P1.5 只接入 Binance USD-M public futures-data，不需要 Binance API key，不读取账户信息，不调用签名接口。

Default scope:

| 维度 | P1.5 默认值 | 说明 |
| --- | --- | --- |
| source | `binance_usds_futures` | Binance U 本位公开衍生品数据 |
| symbol | `BTCUSDT` | 第一刀只覆盖 BTC |
| period | `1h` | 用于影子观察与后续回看 |
| mode | `shadow` | 观察中，不驱动策略 |

P1.5 fact types:

| fact_type | Binance path | 目的 |
| --- | --- | --- |
| `open_interest_hist` | `GET /futures/data/openInterestHist` | 持仓量变化 |
| `global_long_short_account_ratio` | `GET /futures/data/globalLongShortAccountRatio` | 全网账户多空倾向 |
| `top_long_short_position_ratio` | `GET /futures/data/topLongShortPositionRatio` | 大户持仓多空倾向 |
| `top_long_short_account_ratio` | `GET /futures/data/topLongShortAccountRatio` | 大户账户多空倾向 |

P1.5 不接入：

- `takerBuySellVol` / 主动买卖量比。
- 非 Binance provider。
- WebSocket stream。
- 账户、交易、提现、划转、listen-key 等需要 key 或签名的 endpoint。

## 2. Source Fact Mapping

### 2.1 Common Request

All P1.5 endpoints use the same logical request:

| 参数 | P1.5 值 | 说明 |
| --- | --- | --- |
| `symbol` | `BTCUSDT` | 合约 symbol |
| `period` | `1h` | Binance 支持 `5m` 到 `1d`；P1.5 固定 `1h` |
| `limit` | `48` default | 首次实现可拉最近 48 个点 |
| `startTime` | optional | 手动补数据时使用 |
| `endTime` | optional | 手动补数据时使用 |

实现要求：

- 请求不附带 `X-MBX-APIKEY`。
- 请求不附带 `timestamp` / `signature`。
- base URL 默认 `https://fapi.binance.com`。
- collector 必须允许注入 `fetch`，测试不访问真实网络。

### 2.2 `open_interest_hist`

Source payload fields:

| Binance 字段 | Normalized 字段 |
| --- | --- |
| `symbol` | `symbol` |
| `timestamp` | `event_time` |
| `sumOpenInterest` | `sum_open_interest` |
| `sumOpenInterestValue` | `sum_open_interest_value` |
| `CMCCirculatingSupply` | `cmc_circulating_supply` |

Read model value:

| 字段 | 口径 |
| --- | --- |
| `primary_value` | `sum_open_interest_value` if present, otherwise `sum_open_interest` |
| `secondary_value` | `sum_open_interest` when primary uses notional value |
| `value_label` | `OI notional` or `OI contracts` |

### 2.3 Long / Short Ratio Facts

Source payload common fields:

| Binance 字段 | Normalized 字段 |
| --- | --- |
| `symbol` | `symbol` |
| `timestamp` | `event_time` |
| `longShortRatio` | `long_short_ratio` |
| `longAccount` / long-side position field | `long_ratio` |
| `shortAccount` / short-side position field | `short_ratio` |

Read model value:

| 字段 | 口径 |
| --- | --- |
| `primary_value` | `long_short_ratio` |
| `secondary_value` | `long_ratio` if present |
| `value_label` | fact type label |

The normalizer must preserve the original source payload in `raw_payload` so field-name differences can be audited later, but the read model must not expose it to the frontend.

## 3. Stored Fact Contract

`market_derived_fact` is append-friendly and idempotent by market time.

| 字段 | 说明 |
| --- | --- |
| `source` | `binance_usds_futures` for P1.5 |
| `fact_type` | one of the four P1.5 fact types |
| `symbol` | `BTCUSDT` |
| `period` | `1h` |
| `event_time` | market timestamp from Binance payload |
| `collected_at` | when this system stored or refreshed the row |
| `content_hash` | stable hash over normalized identity and raw payload |
| `raw_payload` | full public source payload, DB only |

Unique key:

```text
source + fact_type + symbol + period + event_time
```

Upsert rule:

- Same unique key must not create duplicate facts.
- Re-fetching the same market timestamp may update normalized values, `content_hash`, `raw_payload`, and `collected_at`.
- Implementation must record enough data to detect source revisions by comparing `content_hash`.

## 4. Time Semantics

P1.5 must keep two different clocks:

| Clock | Field | Question answered |
| --- | --- | --- |
| Market time | `event_time` | 这条数据描述哪个市场时间点？ |
| System knowledge time | `collected_at` | 系统什么时候知道这条事实？ |

Replay rule:

```text
visible_facts(replay_as_of) = facts where collected_at <= replay_as_of
```

This prevents future leakage. Example:

| event_time | collected_at | replay_as_of | visible? | Reason |
| --- | --- | --- | --- | --- |
| 10:00 | 10:03 | 10:01 | no | 系统 10:01 还不知道 |
| 10:00 | 10:03 | 10:05 | yes | 系统 10:05 已采集 |

P1.5 only stores and displays this distinction. It does not implement strategy replay yet.

## 5. Read Model Contract

The `/market-data` page consumes a BFF/read model, not database rows.

```ts
type MarketDataFactType =
  | "open_interest_hist"
  | "global_long_short_account_ratio"
  | "top_long_short_position_ratio"
  | "top_long_short_account_ratio";

type MarketDataCollectorState =
  | "shadow_collecting"
  | "partial"
  | "stale"
  | "empty"
  | "blocked";

type MarketDataFactRow = {
  id: string;
  source: "binance_usds_futures";
  fact_type: MarketDataFactType;
  symbol: string;
  period: string;
  event_time: string;
  collected_at: string;
  value_label: string;
  primary_value: string;
  secondary_value?: string;
  content_hash: string;
};

type MarketDataMetricSummary = {
  fact_type: MarketDataFactType;
  label: string;
  latest?: MarketDataFactRow;
  latest_lag_minutes?: number;
  points_24h: number;
  points_7d: number;
  missing_points_24h: number;
  state: MarketDataCollectorState;
};

type P15MarketDataReadModel = {
  generated_at: string;
  source: "binance_usds_futures";
  mode: "shadow";
  symbols: string[];
  periods: string[];
  selected_symbol: string;
  selected_period: string;
  selected_range: "24h" | "7d" | "30d";
  collector_state: MarketDataCollectorState;
  last_success_at?: string;
  metrics: MarketDataMetricSummary[];
  history: MarketDataFactRow[];
};
```

Read model rules:

- It must not contain `raw_payload`, `rawPayload`, API key, account ID, or account credential metadata.
- It must include both `event_time` and `collected_at`.
- Empty DB may fall back to deterministic fixture rows for local page rendering, but UI must show fixture/shadow state clearly.
- Real DB rows take precedence over fixture fallback once available.

## 6. Freshness And Gap Rules

For P1.5 `BTCUSDT` / `1h`:

| Rule | P1.5 target |
| --- | --- |
| Expected cadence | one point per hour per fact type |
| Fresh | latest `event_time` within 2 periods of `generated_at` |
| Stale | latest `event_time` older than 2 periods |
| Empty | no rows for selected fact type |
| Partial | at least one fact type has data and at least one fact type is empty/stale/failed |
| Blocked | collector reports access or network block and no fresh rows are available |

`missing_points_24h` is calculated against 24 expected hourly slots per fact type. P1.5 can use a simple count-based estimate first:

```text
missing_points_24h = max(0, 24 - points_24h)
```

P2+ may replace this with exact slot inspection.

## 7. Frontend Page Contract

Route:

```text
/market-data
```

Required visible sections:

- Collector health strip.
- Four metric panels.
- Historical fact table.
- Shadow scope label: `影子采集 · 不驱动策略`.

History table required columns:

| Column | Source |
| --- | --- |
| `event_time` | `MarketDataFactRow.event_time` |
| `collected_at` | `MarketDataFactRow.collected_at` |
| `fact_type` | `MarketDataFactRow.fact_type` |
| `symbol` | `MarketDataFactRow.symbol` |
| `period` | `MarketDataFactRow.period` |
| `primary_value` | `MarketDataFactRow.primary_value` |
| `content_hash` | short display of `content_hash` |

The page must remain read-only. It must not include confirmation controls, strategy actions, or signal enable/disable controls in P1.5.

