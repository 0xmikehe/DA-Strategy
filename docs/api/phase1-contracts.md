# Phase 1 Contracts

> 本文是 ADR-0007 的实现伴随文档。跨层边界以 `docs/decisions/0007-phase1-cross-layer-contracts.md` 为权威；精确 TypeScript 类型以 `src/contracts/phase1.ts` 为准。

## 目的

P0 只冻结 Phase 1 的最小 DTO，不实现三层业务闭环。P1 开始，账本、信号、策略和前端都通过这些对象交互。

## 规则

- Strategy 只消费 `ActiveSignalSet` / `SignalSnapshotRef` 和 ledger 视图，不直接读取 `src/signal/facts/`。
- Signal facts 归 `src/signal/facts/`，不依赖账本账户事实。
- Ledger 可以引用 `StrategyVersionRef` / `StrategyBindingRef`，但不解释策略规则。
- 财务数量、价格、金额、费用均使用 decimal string。
- 时间统一使用 UTC ISO 8601 字符串。

## DTO

| DTO | Owner | Consumer | Purpose |
| --- | --- | --- | --- |
| `ActiveSignalSet` | signal | strategy | 某个快照下可被策略消费的启用态信号集合 |
| `SignalSnapshotRef` | ledger + signal | strategy / review | 决策时点快照的稳定引用 |
| `LedgerPositionView` | ledger | strategy / frontend | 某策略版本在某时点的持仓视图 |
| `LedgerTradeView` | ledger | strategy / review | 已归属到策略版本的成交视图 |
| `CapitalFlowView` | ledger | strategy / review | 策略现金流事实视图 |
| `AccountBindingStatus` | ledger | strategy / ops UI | 策略与物理子账户绑定健康状态 |
| `StrategyBindingRef` | strategy + ledger | ledger / ops UI / review | 策略版本与物理子账户的时间段绑定 |
| `StrategyVersionRef` | strategy | ledger / review | 账本追溯成交归属所需的策略版本引用 |
| `AssetPoolItem` | strategy | ledger via `SyncSymbolSet` | 策略资产池条目 |
| `SyncSymbolSet` | strategy | ledger | 账本同步所需 spot symbol 集合 |
| `PlannedAction` | strategy | frontend / review | 策略基于快照与账本视图生成的计划动作 |
| `ReviewDraft` | strategy | frontend | 周期复盘草稿 |

## P0 Fixture Rule

P0 只提供类型和测试样例；真实 fixture timeline 在 P1 建立。P0 测试必须证明 `PlannedAction` 能同时追溯到 `snapshot_id` 与 `strategy_version`。
