# ADR-0009: P1.5 市场数据影子采集器

- 状态：Accepted
- 日期：2026-06-20
- 决策者：Codex / hashmike
- 涉及层：signal / frontend / docs

## 背景

Binance `futures/data/*` OI 与多空比族接口只保留近 1 个月数据。若不从 P1.5 起持续自建事实库，后续无法验证历史准确性、信号回看与策略复盘。

P1.5 的目标不是让这些数据立即驱动策略，而是先建立可观察、可回看的市场事实链：系统必须能说明某条市场事实对应哪个市场时间点、何时被本系统采集、来自哪个公开数据源，以及它是否已经在某个复盘时点可被系统知道。

## 决策

P1.5 新增信号层影子采集器，默认采集 Binance USD-M public futures-data 的 `BTCUSDT` / `1h`：

- `open_interest_hist`
- `global_long_short_account_ratio`
- `top_long_short_position_ratio`
- `top_long_short_account_ratio`

数据落入信号层市场事实库，只读公开接口，无账户 key，不调用账户、交易、划转、提现或 listen-key 接口，不驱动策略。页面新增 `/market-data`，展示 latest 与 history，并显式标注 shadow / 观察中 / 不驱动策略。

历史事实必须同时保留：

- `event_time`：Binance payload 对应的市场时间。
- `collected_at`：本系统观察并存储该事实的时间。

后续 replay 必须以 `collected_at <= replay_as_of` 判断当时系统是否已经知道该事实，不能只按 `event_time` 回看，否则会把未来才采集到的数据错误带入过去的策略复盘。

P1.5 默认 provider / venue 为 `binance_usds_futures`。表结构和 collector 接口应保留 `source` / `fact_type` / `symbol` / `period` 维度，以便 P2+ 增加 Bybit 交叉验证源或 Amberdata / Kaiko 等商业数据源；但 P1.5 不接入非 Binance 数据源。

## 备选方案

1. 只展示最近一次采集值：放弃。它只能证明当前 API 可用，无法验证连续性、历史准确性或后续复盘可用性。
2. 把影子数据混入 `/market`：放弃。`/market` 是启用态信号与快照页；P1.5 数据仍是事实采集层，混在一起会让用户误以为它已经驱动判断。
3. P1.5 采集更多 symbol / period：暂缓。先验证 `BTCUSDT` / `1h` 的 collector、存储、history 与页面闭环。
4. P1.5 改用机构级数据商：暂缓。Kaiko / Amberdata / Coin Metrics 等质量更高但会引入费用、API key、授权和字段映射复杂度。P1.5 先以 Binance 原生公开接口沉淀不可回填历史。

## 影响

- `src/signal/facts/` 成为 P1.5 owner。
- `prisma/schema.prisma` 新增市场衍生事实表。
- `/market-data` 只展示 read model，不暴露 raw payload；原始 payload 仅保存在 DB。
- P1.5 不改变 planned action、review draft、strategy version。
- P1.5 的默认验证门不得依赖真实 Binance 网络；真实采集必须显式开启。
