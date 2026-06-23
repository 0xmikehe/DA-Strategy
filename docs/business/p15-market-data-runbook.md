# P1.5 Market Data Runbook

> 本文定义 P1.5 市场数据影子采集的运行、页面检查、验收和排障口径。它描述的是 P1.5 实现目标；在代码落地前，命令属于目标契约，不代表当前仓库已经支持。

## 1. What P1.5 Runs

P1.5 runs a shadow collector for Binance public futures-data:

```text
source: binance_usds_futures
symbol: BTCUSDT
period: 1h
mode: shadow
strategy impact: none
account key: none
```

Collected facts:

- Open interest history.
- Global long/short account ratio.
- Top trader long/short position ratio.
- Top trader long/short account ratio.

The collector writes to `market_derived_fact` under signal facts. It does not write ledger events and does not create planned actions.

## 2. Environment

Target env vars:

```env
BINANCE_FAPI_BASE_URL=https://fapi.binance.com
MARKET_DATA_SHADOW_ENABLED=false
MARKET_DATA_SHADOW_SYMBOLS=BTCUSDT
MARKET_DATA_SHADOW_PERIOD=1h
MARKET_DATA_SHADOW_LIMIT=48
```

Do not add:

```env
BINANCE_API_KEY=
BINANCE_API_SECRET=
```

P1.5 endpoints are public market-data endpoints. If a deployment region is blocked by Binance, adding an API key will not solve that boundary.

## 3. Safe Defaults

Default local verification must stay offline:

```bash
npm run verify
npm run worker:smoke
```

Expected behavior:

- No real Binance request.
- No API key required.
- Worker smoke exits safely.
- `/market-data` can render from deterministic fixture fallback when DB has no real rows.

## 4. Manual Shadow Collection

After implementation, real collection is explicit:

```bash
MARKET_DATA_SHADOW_ENABLED=true npm run worker -- --once --collect-market-data
```

Target successful output shape:

```json
{
  "status": "succeeded",
  "fetched": 192,
  "stored": 192,
  "failed": []
}
```

Partial failure is allowed if at least one endpoint succeeds:

```json
{
  "status": "failed",
  "fetched": 96,
  "stored": 96,
  "failed": [
    {
      "fact_type": "top_long_short_position_ratio",
      "symbol": "BTCUSDT",
      "message": "HTTP 451 restricted location"
    }
  ]
}
```

Partial failures must be visible in logs/read model state, but successful fact types must still be stored.

## 5. Page Check

Route:

```text
http://localhost:3300/market-data
```

The page must show:

- `影子采集 · 不驱动策略`
- collector state
- latest value cards for four fact types
- historical fact table
- both `event_time` and `collected_at`
- no `raw_payload`

Recommended manual checks:

| Check | Expected |
| --- | --- |
| Empty DB | fixture fallback renders and is clearly marked as shadow/fixture |
| After collection | real DB rows replace fixture fallback |
| Wide desktop | table remains readable at 2560px+ |
| Mobile | no overlapping text |
| Raw data leakage | page source does not contain `raw_payload` or `rawPayload` |

## 6. Acceptance Checklist

P1.5 is acceptable when:

- `market_derived_fact` exists and has unique key `source + fact_type + symbol + period + event_time`.
- Collector can fetch four Binance public fact types for `BTCUSDT` / `1h`.
- Collector is idempotent for repeated runs.
- `event_time` and `collected_at` are both stored and displayed.
- Read model can return latest and history.
- `/market-data` renders from read model only.
- Default `npm run verify` does not require network access.
- `npm run build` passes after page work.

P1.5 is not acceptable if:

- Any account API key is required.
- Strategy actions change based on OI / long-short data.
- The page shows only latest values and no history.
- The page exposes raw payload.
- Real Binance network access is required for local test success.

## 7. Troubleshooting

### `blocked`

Likely causes:

- Binance restricted location response.
- DNS/network egress blocked.
- Wrong `BINANCE_FAPI_BASE_URL`.

Expected handling:

- Mark collector/page state as `blocked`.
- Keep local tests passing through mocked fetch and fixture fallback.
- Do not request account API keys as a workaround.

### `stale`

Likely causes:

- Collector has not run recently.
- Scheduler is down.
- Binance returned old rows only.

Expected handling:

- Show latest lag.
- Keep old rows visible in history.
- Do not overwrite or delete prior facts.

### `empty`

Likely causes:

- Migration exists but collector has never run.
- Selected symbol/period has no rows.

Expected handling:

- Render fixture fallback for local UX if configured.
- Show no real rows message.

### duplicate rows

Likely causes:

- Unique key missing or wrong.
- Normalizer maps timestamp inconsistently.

Expected handling:

- Fix idempotency around `source + fact_type + symbol + period + event_time`.
- Re-run collector against the same mocked payload and assert one logical row.

## 8. Future Handoff

P1.5 only builds the market fact history. Future phases may add:

- Bybit as free cross-venue validation.
- Amberdata / Kaiko as commercial historical providers.
- Signal promotion from shadow to enabled.
- Snapshot input refs that include `market_derived_fact`.
- Strategy replay that filters facts with `collected_at <= replay_as_of`.

