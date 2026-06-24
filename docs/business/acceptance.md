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
