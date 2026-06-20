# P1.5 Market Data Shadow Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the P1.5 Binance public market-data shadow collector and `/market-data` page so users can inspect both latest and historical OI / long-short facts.

**Architecture:** P1.5 stays inside the signal layer: Binance public futures-data endpoints are fetched by `src/signal/facts`, normalized into append-friendly market fact tables, exposed through a read model, and rendered by a read-only market data page. These facts are shadow data only: they do not enter strategy actions until a later signal promotion phase.

**Tech Stack:** Next.js 15 app router, React 19, TypeScript, Prisma/Postgres, Vitest, Zod, existing Soft Midnight CSS tokens.

---

## Scope Lock

P1.5 includes:

- Binance USD-M public futures-data collector for `BTCUSDT` and period `1h`.
- Fact types:
  - `open_interest_hist`
  - `global_long_short_account_ratio`
  - `top_long_short_position_ratio`
  - `top_long_short_account_ratio`
- Historical lookup by `symbol`, `period`, `fact_type`, and time range.
- Collector freshness and gap diagnostics.
- `/market-data` page with latest cards, trend/history area, and fact history table.

P1.5 excludes:

- Strategy action changes.
- Signal promotion from shadow to enabled.
- Human confirmation flows.
- Account keys, trading, leverage, shorting, order placement, user-data endpoints.
- Broad altcoin coverage.
- WebSocket streams.

## File Map

Create:

- `docs/decisions/0009-p15-market-data-shadow-collector.md` - ADR freezing P1.5 data, page, and replay semantics.
- `docs/api/p15-market-data-contract.md` - P1.5 source mapping, read model, freshness, and page contract.
- `docs/business/p15-market-data-runbook.md` - P1.5 runbook for manual collection, page checks, and troubleshooting.
- `src/contracts/p15-market-data.ts` - runtime-independent read-model types.
- `src/contracts/p15-market-data.schemas.ts` - Zod schemas for P1.5 read-model boundaries.
- `src/fixtures/phase1/market-data-history.ts` - deterministic fixture rows for tests and empty-DB fallback.
- `src/signal/facts/binance-futures-data-client.ts` - public Binance futures-data client with injectable `fetch`.
- `src/signal/facts/market-derived-facts.ts` - normalization, content hash, upsert keys, and DB query helpers.
- `src/signal/facts/collect-shadow-market-data.ts` - collector orchestration for configured symbols/periods/fact types.
- `src/server/read-model/p15-market-data.ts` - BFF/read model for `/market-data`.
- `src/app/market-data/page.tsx` - P1.5 market data page.
- `src/app/_components/phase1/market-data-history-table.tsx` - history table.
- `src/app/_components/phase1/market-data-metric-panel.tsx` - latest/trend panels.
- `tests/contracts/p15-market-data-schemas.test.ts`
- `tests/signal/binance-futures-data-client.test.ts`
- `tests/signal/market-derived-facts.test.ts`
- `tests/signal/collect-shadow-market-data.test.ts`
- `tests/server/p15-market-data-read-model.test.ts`

Modify:

- `docs/decisions/README.md` - append ADR-0009.
- `docs/api/p1-er.md` - add P1.5 ER delta for market derived facts and replay semantics.
- `docs/api/phase1-contracts.md` - link the P1.5 read model contract.
- `docs/business/phase1-acceptance.md` - add P1.5 acceptance criteria.
- `prisma/schema.prisma` - add `MarketDerivedFactType` and `MarketDerivedFact`.
- `src/server/config/env.ts` - add public market-data env parsing.
- `src/server/worker/index.ts` - add opt-in shadow collection path while keeping smoke offline.
- `src/app/_components/phase1/app-shell.tsx` - add `/market-data` nav item.
- `src/app/page.tsx` - add entry card/status for P1.5 market data.
- `src/app/globals.css` - add responsive layout hooks for market data page.
- `tests/app/p1-pages.test.ts` - assert page/nav rendering and raw payload hiding.
- `tests/worker/worker-smoke.test.ts` - assert smoke remains offline and includes job type support.

## Data Contract

`MarketDerivedFact` stores normalized public futures-data facts:

- `id`
- `source`: P1.5 default `binance_usds_futures`; P2+ may add more providers / venues
- `factType`: enum values listed in scope
- `symbol`: first value `BTCUSDT`
- `period`: first value `1h`
- `eventTime`: market timestamp from Binance payload
- `collectedAt`: when this system observed and stored the fact
- `sumOpenInterest`: only for OI facts
- `sumOpenInterestValue`: only for OI facts
- `cmcCirculatingSupply`: optional OI field
- `longShortRatio`: ratio facts
- `longRatio`: normalized long-side ratio/percentage when present
- `shortRatio`: normalized short-side ratio/percentage when present
- `contentHash`: stable hash of normalized source payload
- `rawPayload`: full source payload

Unique key:

- `(source, factType, symbol, period, eventTime)`

Replay rule:

- `eventTime` answers "what market period is this fact about?"
- `collectedAt` answers "when did this system know it?"
- Future replay must filter on `collectedAt <= replay_as_of`; P1.5 documents and exposes the distinction but does not implement strategy replay.

## Task 0: Freeze P1.5 Contract

**Files:**

- Create: `docs/decisions/0009-p15-market-data-shadow-collector.md`
- Create: `docs/api/p15-market-data-contract.md`
- Create: `docs/business/p15-market-data-runbook.md`
- Modify: `docs/decisions/README.md`
- Modify: `docs/api/p1-er.md`
- Modify: `docs/api/phase1-contracts.md`
- Modify: `docs/business/phase1-acceptance.md`

- [ ] **Step 1: Write ADR-0009**

  Include these decisions:

  ```markdown
  # ADR-0009: P1.5 市场数据影子采集器

  - 状态：Accepted
  - 日期：2026-06-20
  - 决策者：Codex / hashmike
  - 涉及层：signal / frontend / docs

  ## 背景

  Binance `futures/data/*` OI 与多空比族接口只保留近 1 个月数据。若不从 P1.5 起持续自建事实库，后续无法验证历史准确性、信号回看与策略复盘。

  ## 决策

  P1.5 新增信号层影子采集器，采集 Binance USD-M public futures-data 的 `BTCUSDT` / `1h`：

  - `open_interest_hist`
  - `global_long_short_account_ratio`
  - `top_long_short_position_ratio`
  - `top_long_short_account_ratio`

  数据落入信号层市场事实库，只读公开接口，无账户 key，不驱动策略。页面新增 `/market-data`，展示 latest 与 history，并显式标注 shadow / 观察中 / 不驱动策略。

  历史事实必须保留 `event_time` 与 `collected_at`，后续 replay 以 `collected_at <= replay_as_of` 判断当时系统是否已经知道该事实。

  P1.5 默认 provider / venue 为 `binance_usds_futures`。表结构和 collector 接口保留 `source` / `fact_type` / `symbol` / `period` 维度，以便 P2+ 增加 Bybit 或商业数据源；P1.5 不接入非 Binance 数据源。

  ## 备选方案

  1. 只展示最近一次采集值：放弃。无法验证连续性和历史准确性。
  2. 把数据混入 `/market`：放弃。会混淆事实采集与启用态信号。
  3. P1.5 采集更多 symbol / period：暂缓。先验证最小闭环。
  4. P1.5 改用机构级数据商：暂缓。质量更高但引入费用、API key、授权和字段映射复杂度。

  ## 影响

  - `src/signal/facts/` 成为 P1.5 owner。
  - `prisma/schema.prisma` 新增市场衍生事实表。
  - `/market-data` 只展示 read model，不暴露 raw payload；原始 payload 仅保存在 DB。
  - P1.5 不改变 planned action、review draft、strategy version。
  ```

- [ ] **Step 2: Update ADR index**

  Append:

  ```markdown
  | [0009](0009-p15-market-data-shadow-collector.md) | P1.5 市场数据影子采集器 | Accepted | signal / frontend / docs | 2026-06-20 |
  ```

- [ ] **Step 3: Update ER, acceptance, contract, and runbook docs**

  Add a P1.5 ER delta section and companion docs with:

  - `MarketDerivedFact` fields from "Data Contract".
  - Relation statement: no FK to strategy or ledger; later signal snapshots may reference facts by `(source, fact_type, symbol, period, event_time)`.
  - Read model statement: frontend receives normalized summaries/history rows, never raw payload.
  - Data contract for endpoint mapping, stored facts, read model, freshness, and `/market-data` page contract.
  - Runbook for env vars, manual collection, page checks, acceptance, and troubleshooting.

- [ ] **Step 4: Review docs**

  Run:

  ```bash
  rg -n "P1.5|MarketDerivedFact|market_derived_fact|market-data|collected_at|event_time|p15-market-data" docs
  ```

  Expected: ADR, ER, acceptance, data contract, and runbook docs all mention P1.5 scope and replay semantics.

- [ ] **Step 5: Commit contract**

  ```bash
  git add docs/decisions/0009-p15-market-data-shadow-collector.md docs/decisions/README.md docs/api/p1-er.md docs/api/phase1-contracts.md docs/api/p15-market-data-contract.md docs/business/phase1-acceptance.md docs/business/p15-market-data-runbook.md docs/superpowers/plans/2026-06-20-p15-market-data-shadow-collector.md
  git commit -m "docs: freeze p15 market data shadow collector contract"
  ```

## Task 1: Add Prisma Schema And Migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: the Prisma-generated migration directory under `prisma/migrations/` whose suffix is `_add_p15_market_derived_facts`

- [ ] **Step 1: Add enum and model**

  Insert after `FundingRateFact`:

  ```prisma
  enum MarketDerivedFactType {
    open_interest_hist
    global_long_short_account_ratio
    top_long_short_position_ratio
    top_long_short_account_ratio
  }

  model MarketDerivedFact {
    id                   String                @id @default(uuid())
    source               String
    factType             MarketDerivedFactType @map("fact_type")
    symbol               String
    period               String
    eventTime            DateTime              @map("event_time")
    collectedAt          DateTime              @default(now()) @map("collected_at")
    sumOpenInterest      Decimal?              @map("sum_open_interest") @db.Decimal(38, 18)
    sumOpenInterestValue Decimal?              @map("sum_open_interest_value") @db.Decimal(38, 18)
    cmcCirculatingSupply Decimal?              @map("cmc_circulating_supply") @db.Decimal(38, 18)
    longShortRatio       Decimal?              @map("long_short_ratio") @db.Decimal(38, 18)
    longRatio            Decimal?              @map("long_ratio") @db.Decimal(38, 18)
    shortRatio           Decimal?              @map("short_ratio") @db.Decimal(38, 18)
    contentHash          String                @map("content_hash")
    rawPayload           Json                  @map("raw_payload")

    @@unique([source, factType, symbol, period, eventTime])
    @@index([symbol, period, factType, eventTime])
    @@index([factType, collectedAt])
    @@map("market_derived_fact")
  }
  ```

- [ ] **Step 2: Generate migration**

  Run:

  ```bash
  npm run db:migrate -- --name add_p15_market_derived_facts
  ```

  Expected: Prisma creates a migration and reports database in sync.

- [ ] **Step 3: Validate schema status**

  Run:

  ```bash
  npm run prisma:validate
  npm run db:status
  ```

  Expected: both commands pass; migration status is up to date.

- [ ] **Step 4: Commit schema**

  ```bash
  git add prisma/schema.prisma prisma/migrations
  git commit -m "feat: add p15 market derived fact schema"
  ```

## Task 2: Add Contracts And Fixtures

**Files:**

- Create: `src/contracts/p15-market-data.ts`
- Create: `src/contracts/p15-market-data.schemas.ts`
- Create: `src/fixtures/phase1/market-data-history.ts`
- Create: `tests/contracts/p15-market-data-schemas.test.ts`

- [ ] **Step 1: Define read model types**

  `src/contracts/p15-market-data.ts` should export:

  ```ts
  import type { DecimalString, IsoDateTimeString } from "./phase1";

  export type MarketDataFactType =
    | "open_interest_hist"
    | "global_long_short_account_ratio"
    | "top_long_short_position_ratio"
    | "top_long_short_account_ratio";

  export type MarketDataCollectorState = "shadow_collecting" | "partial" | "stale" | "empty" | "blocked";

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
  ```

- [ ] **Step 2: Add Zod schemas**

  Validate strict objects for the types above. `MarketDataFactRow` must reject `raw_payload` and `rawPayload`.

- [ ] **Step 3: Add deterministic fixture**

  Create 8-12 rows across the four fact types for `BTCUSDT` / `1h`, with event times on `2026-06-20T00:00:00.000Z` through `2026-06-20T02:00:00.000Z`.

- [ ] **Step 4: Test schemas**

  Add tests asserting:

  - valid fixture rows parse.
  - invalid fact type fails.
  - raw payload keys fail.
  - read model parses with `mode: "shadow"`.

  Run:

  ```bash
  npm run test -- tests/contracts/p15-market-data-schemas.test.ts
  ```

- [ ] **Step 5: Commit contracts**

  ```bash
  git add src/contracts/p15-market-data.ts src/contracts/p15-market-data.schemas.ts src/fixtures/phase1/market-data-history.ts tests/contracts/p15-market-data-schemas.test.ts
  git commit -m "feat: add p15 market data contracts"
  ```

## Task 3: Add Binance Public Data Client

**Files:**

- Create: `src/signal/facts/binance-futures-data-client.ts`
- Create: `tests/signal/binance-futures-data-client.test.ts`
- Modify: `src/server/config/env.ts`

- [ ] **Step 1: Extend env parsing**

  Add optional envs with safe defaults:

  ```ts
  BINANCE_FAPI_BASE_URL=https://fapi.binance.com
  MARKET_DATA_SHADOW_ENABLED=false
  MARKET_DATA_SHADOW_SYMBOLS=BTCUSDT
  MARKET_DATA_SHADOW_PERIOD=1h
  ```

  Tests should confirm no account key is required.

- [ ] **Step 2: Implement client**

  The client must:

  - Accept injected `fetch`.
  - Build query strings with `symbol`, `period`, and `limit`.
  - Support the four P1.5 endpoints.
  - Throw a typed error for non-2xx responses.
  - Never read API key or secret env vars.

- [ ] **Step 3: Test client with mocked fetch**

  Tests assert exact URL paths:

  - `/futures/data/openInterestHist`
  - `/futures/data/globalLongShortAccountRatio`
  - `/futures/data/topLongShortPositionRatio`
  - `/futures/data/topLongShortAccountRatio`

  Run:

  ```bash
  npm run test -- tests/signal/binance-futures-data-client.test.ts
  ```

- [ ] **Step 4: Commit client**

  ```bash
  git add src/server/config/env.ts src/signal/facts/binance-futures-data-client.ts tests/signal/binance-futures-data-client.test.ts
  git commit -m "feat: add binance futures data client"
  ```

## Task 4: Normalize And Store Market Derived Facts

**Files:**

- Create: `src/signal/facts/market-derived-facts.ts`
- Create: `tests/signal/market-derived-facts.test.ts`
- Modify: `src/signal/facts/index.ts`

- [ ] **Step 1: Implement normalizers**

  Normalize each Binance payload into `MarketDerivedFact` data:

  - OI maps `timestamp` to `eventTime`, `sumOpenInterest`, `sumOpenInterestValue`, and optional `CMCCirculatingSupply`.
  - Ratio facts map `timestamp`, `longShortRatio`, and whichever long/short fields the endpoint returns.
  - `contentHash` is a SHA-256 hash over a stable JSON string of source, fact type, symbol, period, event time, and raw payload.

- [ ] **Step 2: Implement upsert helper**

  Use unique key `(source, factType, symbol, period, eventTime)`.

  Existing rows may update `contentHash`, `rawPayload`, and normalized values when re-fetched. They must preserve first `collectedAt` because replay uses it as system knowledge time. They must not create duplicates.

- [ ] **Step 3: Implement query helper**

  Query by:

  - `symbol`
  - `period`
  - optional `factType`
  - `eventTime` range
  - optional `knownAt` for future replay semantics using `collectedAt <= knownAt`

- [ ] **Step 4: Test normalization and idempotency**

  Tests assert:

  - OI normalization preserves market timestamp.
  - Ratio normalization creates decimal strings/Prisma decimals safely.
  - Same unique key produces one logical row.
  - `knownAt` filtering excludes facts collected after replay time.

  Run:

  ```bash
  npm run test -- tests/signal/market-derived-facts.test.ts
  ```

- [ ] **Step 5: Commit fact storage**

  ```bash
  git add src/signal/facts/index.ts src/signal/facts/market-derived-facts.ts tests/signal/market-derived-facts.test.ts
  git commit -m "feat: store p15 market derived facts"
  ```

## Task 5: Add Shadow Collector Orchestration

**Files:**

- Create: `src/signal/facts/collect-shadow-market-data.ts`
- Create: `tests/signal/collect-shadow-market-data.test.ts`
- Modify: `src/server/worker/index.ts`
- Modify: `tests/worker/worker-smoke.test.ts`

- [ ] **Step 1: Implement collector**

  Collector inputs:

  ```ts
  {
    symbols: ["BTCUSDT"],
    period: "1h",
    limit: 48,
    factTypes: [
      "open_interest_hist",
      "global_long_short_account_ratio",
      "top_long_short_position_ratio",
      "top_long_short_account_ratio"
    ]
  }
  ```

  Collector output:

  ```ts
  {
    status: "succeeded" | "failed",
    fetched: number,
    stored: number,
    failed: Array<{ fact_type: string; symbol: string; message: string }>
  }
  ```

- [ ] **Step 2: Keep default worker smoke offline**

  `npm run worker:smoke` must not call Binance. Add an opt-in code path such as `--collect-market-data` and/or `MARKET_DATA_SHADOW_ENABLED=true`.

- [ ] **Step 3: Test orchestration**

  Mock the client and repository:

  - succeeds when all four endpoints return rows.
  - records partial failure without throwing away successful fact types.
  - worker smoke remains `{ status: "ok", mode: "smoke" }`.

  Run:

  ```bash
  npm run test -- tests/signal/collect-shadow-market-data.test.ts tests/worker/worker-smoke.test.ts
  ```

- [ ] **Step 4: Commit collector**

  ```bash
  git add src/signal/facts/collect-shadow-market-data.ts src/server/worker/index.ts tests/signal/collect-shadow-market-data.test.ts tests/worker/worker-smoke.test.ts
  git commit -m "feat: add p15 shadow market data collector"
  ```

## Task 6: Add P1.5 Read Model

**Files:**

- Create: `src/server/read-model/p15-market-data.ts`
- Create: `tests/server/p15-market-data-read-model.test.ts`

- [ ] **Step 1: Build read model**

  `getP15MarketDataReadModel()` should:

  - Query recent DB facts when available.
  - Fall back to deterministic fixture rows when DB is empty.
  - Return `mode: "shadow"`.
  - Calculate `points_24h`, `points_7d`, `missing_points_24h`, latest lag, and collector state.
  - Exclude `rawPayload` and `raw_payload`.

- [ ] **Step 2: Test read model**

  Tests assert:

  - empty DB fallback renders fixture data.
  - read model never includes raw payload.
  - latest + history are both present.
  - `collected_at` and `event_time` are distinct fields.

  Run:

  ```bash
  npm run test -- tests/server/p15-market-data-read-model.test.ts
  ```

- [ ] **Step 3: Commit read model**

  ```bash
  git add src/server/read-model/p15-market-data.ts tests/server/p15-market-data-read-model.test.ts
  git commit -m "feat: expose p15 market data read model"
  ```

## Task 7: Add `/market-data` Page

**Files:**

- Create: `src/app/market-data/page.tsx`
- Create: `src/app/_components/phase1/market-data-history-table.tsx`
- Create: `src/app/_components/phase1/market-data-metric-panel.tsx`
- Modify: `src/app/_components/phase1/app-shell.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/app/p1-pages.test.ts`

- [ ] **Step 1: Add nav item**

  Add `marketData` to `ActiveSection`, nav label `D`, href `/market-data`, title `市场数据`.

- [ ] **Step 2: Implement page content**

  Page must show:

  - Title: `市场数据`
  - Kicker: `Market Data / Shadow Facts`
  - Visible state copy: `影子采集 · 不驱动策略`
  - Collector state strip.
  - Four metric panels.
  - History table with `event_time`, `collected_at`, `fact_type`, `symbol`, `period`, `primary_value`, `content_hash`.

  Do not render raw payload.

- [ ] **Step 3: Add responsive CSS**

  Reuse existing Soft Midnight tokens. Add wide-screen layout rules under existing `@media (min-width: 2560px)` so the page uses comfortable 2560+ width without stretching tables into unreadable lines.

- [ ] **Step 4: Test static render**

  Extend `tests/app/p1-pages.test.ts`:

  - import and render `MarketDataPage`.
  - assert `/market-data` nav or page title exists.
  - assert `影子采集` and `event_time` appear.
  - assert `raw_payload` and `rawPayload` do not appear.

  Run:

  ```bash
  npm run test -- tests/app/p1-pages.test.ts
  ```

- [ ] **Step 5: Commit page**

  ```bash
  git add src/app/market-data/page.tsx src/app/_components/phase1/market-data-history-table.tsx src/app/_components/phase1/market-data-metric-panel.tsx src/app/_components/phase1/app-shell.tsx src/app/page.tsx src/app/globals.css tests/app/p1-pages.test.ts
  git commit -m "feat: add p15 market data page"
  ```

## Task 8: Full Verification And Browser QA

**Files:**

- No new files unless tests reveal defects.

- [ ] **Step 1: Run aggregate backend/frontend gate**

  ```bash
  npm run verify
  npm run build
  ```

  Expected: both pass.

- [ ] **Step 2: Start or reuse dev server**

  ```bash
  npm run dev
  ```

  Expected: app serves on `http://localhost:3300`.

- [ ] **Step 3: HTTP smoke**

  ```bash
  curl -I http://localhost:3300/
  curl -I http://localhost:3300/market-data
  ```

  Expected: both return HTTP 200.

- [ ] **Step 4: Visual QA**

  Verify in browser at:

  - 1440px desktop
  - 2560px wide desktop
  - mobile width

  Check:

  - no overlapping text.
  - no raw payload visible.
  - page clearly says shadow / not driving strategy.
  - history table remains readable on wide screens.

- [ ] **Step 5: Final diff review**

  ```bash
  git status --short
  git log --oneline -8
  ```

  Expected: only intended P1.5 commits and clean worktree.

## Recommended Execution Rhythm

Proceed in four reviewable slices:

1. **P1.5-A Contract:** Task 0 only. User reviews ADR / ER / acceptance wording.
2. **P1.5-B Data Foundation:** Tasks 1-4. Schema, contracts, fixtures, client, storage.
3. **P1.5-C Collector:** Task 5. Worker-integrated shadow collector, offline verify preserved.
4. **P1.5-D Read Model + Page:** Tasks 6-8. `/market-data`, historical view, verification and browser QA.

This keeps each slice independently reviewable and avoids mixing visual feedback with collector correctness.
