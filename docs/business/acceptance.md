# Acceptance Baselines

This document gathers business-facing acceptance criteria by phase.

It is not cross-layer contract authority. Phase 1 cross-layer contracts are governed by `docs/decisions/0007-phase1-cross-layer-contracts.md` and `src/contracts/phase1.ts`. Technical runtime baselines are governed by `docs/decisions/0006-phase1-technical-baseline.md`.

## Phase 1 Acceptance Baseline

### P0 Engineering Acceptance

P0完成时，系统还不产生投资判断，也不连接真实 Binance。P0 只证明工程地基成立：

- Next.js 应用能构建。
- `/api/health` 能返回本服务的 P0 健康状态。
- Postgres 可通过本地 Docker Compose 启动。
- Prisma schema 可验证。
- 独立 worker smoke 命令可执行并安全退出。
- `src/contracts/phase1.ts` 已定义 ADR-0007 的最小 DTO。
- `src/ledger/`、`src/signal/`、`src/signal/facts/`、`src/strategy/` 目录存在且边界清晰。
- 验证门可由 agent 直接复制运行。

### P1 Walking Skeleton Acceptance

P1 才开始实现三层最小闭环。P1 完成时，应能用 fixture 跑通：

- 市场事实进入 signal fixture。
- Signal 产生启用态 `ActiveSignalSet` 与快照内容。
- Ledger 提供最小快照容器、账户事件和策略持仓视图。
- Strategy 读取 `ActiveSignalSet + snapshot_id` 和账本视图，生成 `PlannedAction`。
- 最小市场页与账本页能展示 fixture 闭环的关键结果。
- 所有输出都可追溯到 `snapshot_id`、`strategy_version` 和账本事件 ID。

### P1.5 Market Data Shadow Collector Acceptance

P1.5 在 P1 行走骨架之后补真实公开市场 facts 的影子采集。P1.5 完成时，应能证明：

专项契约与运行口径：

- 数据契约：`docs/api/p15-market-data-contract.md`
- 运行与排障：`docs/business/p15-market-data-runbook.md`

- 系统可显式开启 Binance public futures-data shadow collector。
- collector 默认采集 `BTCUSDT` / `1h` 的 OI 与多空比族数据：
  - `open_interest_hist`
  - `global_long_short_account_ratio`
  - `top_long_short_position_ratio`
  - `top_long_short_account_ratio`
- 采集结果写入 signal/facts 所属事实库，不进入 ledger / strategy 表。
- 每条事实同时保留 `event_time` 与 `collected_at`，能区分「市场事实发生时间」与「系统知道该事实的时间」。
- `/market-data` 页面能展示 latest、history、freshness、lag、missing points，并明确标注影子采集、不驱动策略。
- 页面和 read model 不暴露 `raw_payload`，只展示归一化 summary/history 字段。
- 默认本地验证门不依赖真实 Binance 网络；真实采集必须由人显式开启。

P1.5 做完后能验证：

- 公开市场数据采集链路可用。
- 不可完整历史回填的数据开始被本系统沉淀。
- 用户能回看已经采集过的事实，检查连续性与异常点。
- 后续 signal replay / strategy review 有了事实历史基础。

P1.5 做完后仍不能声称：

- OI / 多空比已经是启用态信号。
- 策略动作因此变得更好。
- 系统可以自动调仓或确认计划动作。
- 数据源已经覆盖非 Binance provider。

### Full Phase 1 Acceptance

完整 Phase 1 覆盖 P0-P7。只有以下条件全部满足，才算 Phase 1 完成：

- Binance 来源市场 facts 能写入 `src/signal/facts/`。
- Binance 只读账户同步能写入只追加账本事件流。
- 一个实盘策略绑定一个 Binance 物理子账户。
- 策略动作绑定 `snapshot_id + strategy_version`。
- 策略页、市场页、账本页、复盘页都有最小可用版本。
- 周复盘草稿可生成，人确认后可触发策略规则新版本。
- 首次真实同步前已经完成数据库备份与恢复演练。

### P0 Explicit Non-Goals

- 不做真实 Binance 同步。
- 不做真实市场 collector。
- 不做 P1.5 OI / 多空比影子采集器。
- 不做外部信号推送。
- 不做自动下单。
- 不做非 Binance 数据源。
- 不保存任何真实 API key、secret 或账户导出数据。

## P2 Ledger Acceptance

P2 ledger acceptance is defined in `docs/implementation/p2-ledger/00-acceptance.md`.
