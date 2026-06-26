# Phase 1 Implementation Plan

**Goal:** 先在 6–8 周时间盒内跑通一条可见、可验证的行走骨架（P0 + P1），作为 go/no-go 闸门；骨架成立后再加宽到完整 Phase 1：Binance 只读数据进入市场事实库与账户事实库，信号产生快照，策略消费「启用态信号集 + 快照 ID」生成计划动作，账本回放真实执行，复盘反哺策略版本。

**Architecture:** 采用三层纵向切片推进：`src/ledger/` 只管账户事实与对账，`src/signal/` 只管市场事实、信号和快照内容，`src/strategy/` 只管策略对象、计划动作、绩效和复盘。开发顺序先冻结跨层契约，再做 fixture 驱动的本地闭环，最后接真实 Binance 只读 API。

**Tech Stack:** Phase 1 主库固定为 PostgreSQL；本计划建议 Phase 0 冻结一套 TypeScript 全栈方案（Next.js + PostgreSQL + Prisma 或 Drizzle + Vitest + Playwright + 独立 Node worker），并把验证门写回 `AGENTS.md` 后再进入代码实现。

---

## 0. 当前判断

当前仓库仍以文档为主，`src/ledger/`、`src/signal/`、`src/strategy/` 仅有目录占位。因此 Phase 1 不能从某个业务模块直接开写，而要先完成两件事：

1. 冻结技术栈、数据库 schema、验证门和跨层接口；
2. 用 fixture 跑通一条纵向闭环，再逐层加厚。

不建议按「账本全部做完 → 信号全部做完 → 策略全部做完 → 前端全部做完」横向瀑布推进。正确策略是每个阶段都能独立验证，并逐步扩大闭环。

这里必须区分两个目标：

- **6–8 周时间盒目标**：只约束 P0 + P1。它回答「这套系统能不能跑出一条可见闭环」，也是《立项书》§19.2 项目失效条件的 go/no-go 闸门。
- **完整 Phase 1 目标**：P2–P7 属于骨架成立后的加宽，不受 6–8 周时间盒约束，但每个阶段仍需独立验收。

## 1. 两层完成定义

### 1.1 6–8 周骨架 Go/No-Go 定义（P0 + P1）

6–8 周内必须完成以下条件；若失败，应触发一次项目级复盘，判断是继续、缩小范围，还是暂停：

- 技术栈、PostgreSQL 主库、worker / 调度模型、验证门和跨层契约已冻结。
- fixture 驱动的市场事实、账户事实、信号快照、策略计划和复盘草稿能跑通一条完整闭环。
- 账本层提供最小快照容器，信号层提供最小快照内容，策略层只消费 `ActiveSignalSet + snapshot_id`。
- 至少有一个 `core_allocation_lt` 策略对象、一个策略版本、一个资产池和一条 `planned_action`。
- 市场页和账本页有最小只读 UI，使人能看到信号、快照、账本回放、对账状态和同步状态。
- 没有真实 API key、真实账户数据、真实 Binance 网络请求；所有数据来自 fixture。

### 1.2 完整 Phase 1 加宽定义（P2–P7）

完整 Phase 1 只有在以下条件全部满足时才算完成：

- Binance 源行情与公开衍生品数据可进入 `src/signal/facts/`，并产生第一版启用态信号集。
- Binance 账户只读同步可把成交、余额、主子账户划转、充提等账户事实写入只追加事件流。
- 1 个实盘策略绑定 1 个 Binance 物理子账户，正常成交能自动归属到策略与当时生效的 `strategy_version`。
- 信号层能生成决策时点快照；策略层的每个计划动作绑定 `snapshot_id + strategy_version`。
- 策略层能基于启用态信号、账本持仓和薄全局风险层，生成 `risk_regime -> target_allocation_band -> planned_action`。
- 策略页能展示策略卡、当前持仓、风险层状态、计划动作和版本历史。
- 复盘页能自动生成周复盘草稿，人确认后能触发一次策略规则变更并生成新版本。
- 市场页、账本页、策略页、复盘页都有最小可用版本。
- 外部推送、自动下单、非 Binance 数据源、纸面策略、多策略调度均不进入 Phase 1。

## 2. 分阶段总览

| 阶段 | 名称 | 目标 | 时间盒归属 | 是否可并行 |
| --- | --- | --- | --- | --- |
| P0 | 技术栈与契约冻结 | 把技术选型、PostgreSQL、worker、验证门、跨层接口定死 | 6–8 周骨架 | 不可并行，必须先完成 |
| P1 | 本地行走骨架 | 用 fixture 跑通三层闭环 + 最小市场页/账本页 | 6–8 周骨架 | 不可拆太散，需一个 owner 串通 |
| P1.5 | 短保留市场数据影子采集器 | 一有非限制区出口就常驻采集 OI / 多空比 | 骨架旁路，尽早启动 | 可由 signal owner 独立推进 |
| P2 | 账本加厚 | 事件流、物理子账户归属、回放、对账、真实账户同步 | Phase 1 加宽 | P1 后可由 ledger owner 独立推进 |
| P3 | 信号加厚 | `src/signal/facts/`、信号注册表、快照、站内动态 | Phase 1 加宽 | P1 后可由 signal owner 独立推进 |
| P4 | 策略引擎加厚 | 策略对象、版本化、风险层、计划动作 | Phase 1 加宽 | P2/P3 契约稳定后推进 |
| P5 | 前端加宽 | 策略页、复盘页、市场页/账本页补齐 | Phase 1 加宽 | API mock 稳定后可并行 |
| P6 | 绩效、偏离与复盘闭环 | TWR/MWR、执行偏离、周复盘草稿、确认流 | Phase 1 加宽 | 依赖 P2/P4 |
| P7 | 真实 Binance 接入与运行硬化 | 完整 API 实测、同步硬化、备份恢复 | Phase 1 加宽 | 依赖 P2/P3 的本地实现 |

## 3. P0：技术栈与契约冻结

### 3.1 目标

把所有 agent 后续会共享的技术和接口前提冻结下来。P0 没完成前，不允许多 agent 并行写业务代码。

### 3.2 交付物

- `docs/decisions/0006-phase1-technical-baseline.md`
  - 决定前端框架、后端运行方式、PostgreSQL 主库、ORM / query layer、测试框架、独立 worker / 调度机制、部署形态、备份策略。
- `docs/decisions/0007-phase1-cross-layer-contracts.md`
  - 作为跨层契约唯一权威，冻结 ledger / signal / strategy 的 DTO、快照 schema、事件命名、时间/Decimal 规范。
- `AGENTS.md`
  - 回填真实验证门，例如 `lint`、`typecheck`、`test`、`test:e2e`。
- `docs/api/phase1-contracts.md`
  - 记录前端和内部模块消费的 API / service contract；内容必须引用 ADR-0007，不得另起一套契约。
- `docs/business/acceptance.md`
  - 用业务语言写清 6–8 周骨架验收样例与完整 Phase 1 加宽验收样例。

### 3.3 关键决策

- 推荐技术栈：Next.js + TypeScript + PostgreSQL + Prisma 或 Drizzle + Vitest + Playwright + Node worker。
- 数据库直接定 PostgreSQL，不再作为开放取舍；本地和 CI 均使用一次性 Postgres，不做 SQLite/Postgres 双库兼容。
- 选择 PostgreSQL 的理由：web + worker 会并发写入，财务数量需要原生 `NUMERIC` 保真，账本事件 / 市场事实 / 快照 / 策略版本属于不可丢失的事实数据，不值得未来再迁移主库。
- 金额、数量、价格、收益率统一使用 Decimal 字符串入库，禁止用 float 表示资金。
- 时间统一存 UTC timestamp，界面按用户时区显示。
- 独立 worker 与调度模型属于 ADR-0006 范围，必须定义 `job_run`、`sync_cursor`、重试、限频、可观测与部署方式。
- 所有跨层输出只传 DTO，不允许 strategy 直接 import signal facts 或 Binance client。
- Phase 1 的 Binance 真实访问在非限制区环境集中实测；本地和 CI 以 fixture / mock 为主。
- 资产池归 strategy owner；ledger 只消费资产池派生出的 `sync_symbol_set`，signal 不依赖策略资产池，signal 的采集 universe 由信号注册表决定。
- 首次真实同步开始前，必须已有数据库备份与恢复演练方案。

### 3.4 验收标准

- `AGENTS.md` 不再有占位验证门。
- 两条 ADR 明确 accepted，且没有与总 PRD / 三层 PRD 冲突。
- ADR-0006 明确 PostgreSQL、worker / 调度、备份与部署形态。
- ADR-0007 成为唯一跨层契约权威；三份子 PRD 与 API 文档只引用它，不复制漂移。
- `docs/api/phase1-contracts.md` 至少覆盖：
  - `LedgerPositionView`
  - `LedgerTradeView`
  - `CapitalFlowView`
  - `SignalSnapshot`
  - `ActiveSignalSet`
  - `StrategyVersion`
  - `PlannedAction`
  - `ReviewDraft`
  - `AssetPool`
  - `SyncSymbolSet`
- 后续每个开发分支都能引用同一组验证命令。

## 4. P1：本地行走骨架

### 4.1 目标

在不接真实 Binance 的前提下，用 fixture 跑通「市场事实 → 信号快照 → 策略计划 → 账本执行回放 → 复盘草稿」的最小闭环，并提供最小只读市场页 + 账本页，让人能肉眼验证闭环是否成立。

### 4.2 文件与目录

- `src/ledger/`
  - fixture 账户事件、回放函数、策略持仓视图、最小决策快照容器。
- `src/signal/`
  - fixture 市场事实、信号注册表、最小快照内容 schema、快照生成函数。
- `src/strategy/`
  - 单策略对象、资产池、风险层、计划动作、复盘草稿生成。
- 前端页面
  - 最小市场页：当前启用态信号、最近快照、信号输入摘要。
  - 最小账本页：策略持仓回放、最近成交、对账状态、同步状态占位。
- `tests/fixtures/phase1/`
  - 一组完整业务样例：市场数据、账户事件、策略配置、预期动作、预期复盘。

### 4.3 最小业务样例

样例要覆盖以下时间线：

1. 系统已有 BTC / ETH / ETHBTC K 线和 funding rate 市场事实。
2. 信号层生成快照：BTC 趋势、ETH 趋势、ETH/BTC 强弱、资金费率温度。
3. 策略层读取启用态信号集和空仓 / 部分持仓，生成一条 `planned_action`。
4. 人在 Binance 手动执行后，fixture 中出现一笔成交事件。
5. 账本回放成交，自动归属到 `core_allocation_lt` 策略与当时版本。
6. 市场页能看到启用态信号和最近快照；账本页能看到持仓回放、成交归属和对账状态。
7. 复盘生成周草稿，人确认后产生策略规则新版本。

### 4.4 骨架内的命名交付物

- **最小资产池**（owner: strategy）
  - 定义 T0 稳定币、T1 BTC/ETH、T2 卫星资产占位。
  - 产出 `AssetPool` 与 `SyncSymbolSet` DTO。
  - ledger 消费 `SyncSymbolSet` 派生 Binance `myTrades` / `allOrders` symbol 清单。
  - signal 不消费资产池；signal 的 market facts universe 由信号注册表决定。
- **最小快照容器**（owner: ledger）
  - 提供 `snapshot_id`、创建时间、内容引用、按 ID 取回能力。
  - P1 只满足策略决策和页面查看；P2 加厚索引、关联和保留策略。
- **最小快照内容**（owner: signal）
  - 存活跃信号集、各信号 version、`raw_value` / `emitted_value`、触发时间和输入摘要。
  - P1 允许输入事实切片先用 fixture 引用；P3 加厚为真实 facts 引用和完整快照查看器。
- **最小只读 UI**（owner: frontend，骨架内完成）
  - 市场页只读展示当前启用态信号和最近快照。
  - 账本页只读展示 fixture 回放出的策略持仓、最近成交和对账状态。

### 4.5 验收标准

- 一条测试命令能跑通上述完整样例。
- 所有输出都能追溯到 `snapshot_id`、`strategy_version` 和账本事件 ID。
- 没有真实 API key、真实账户数据、真实 Binance 网络请求。
- 市场页和账本页最小只读 UI 可打开，并能展示 fixture 闭环的关键结果。
- P1 结束时必须形成 P2/P3/P4 的交接记录：
  - ledger 接手快照容器、账本事件流和回放加厚；
  - signal 接手快照内容、市场事实库和真实信号计算加厚；
  - strategy 接手资产池、策略版本、风险层和计划动作加厚。

## 5. P1.5：短保留市场数据影子采集器

### 5.1 目标

一旦具备 Binance 非限制区出口和 PostgreSQL，就先常驻采集 OI / 多空比这类短保留公开市场数据。它不驱动策略、不需要账户 key、不阻塞 P1 骨架，但要尽早保护不可再生历史。

### 5.2 为什么必须单拆

Binance `futures/data/*` 一类数据历史保留窗口短，错过就无法回填。若等 P7 完整真实 Binance 接入才开始采集，就会丢掉 Phase 1 早期最需要沉淀的影子观察数据。该类接口是公开数据、无需账户 key，且调研中记录为 weight 0，适合先作为独立影子采集器常驻。

### 5.3 实施顺序

- [ ] 使用 P0 确定的 PostgreSQL schema，建立或复用：
  - `open_interest_observation`
  - `long_short_ratio_observation`
  - `market_data_run`
  - `sync_cursor`
- [ ] 实现 public Binance collector：
  - `futures/data/openInterestHist`
  - `futures/data/globalLongShortAccountRatio`
  - `futures/data/topLongShortAccountRatio`
- [ ] 实现独立调度：
  - 无账户 key；
  - 低频轮询；
  - 独立 `job_run`；
  - 失败重试和 freshness 状态；
  - restricted location 错误显式标记。
- [ ] 写入 `src/signal/facts/`，生命周期标记为观察态数据源。
- [ ] 只在市场页或运行状态页显示采集健康，不进入策略 `ActiveSignalSet`。

### 5.4 验收标准

- 在非限制区出口下，采集器能连续写入 OI / 多空比 facts。
- 不需要任何 Binance account key，不调用 signed endpoint。
- 采集数据不驱动 `risk_regime`、`target_allocation_band` 或 `planned_action`。
- 断网、限频、restricted location 都能被记录到 `market_data_run` / `job_run`。
- P3 可以无破坏地接手这些 facts，把它们纳入快照观察区和回测样本。

## 6. P2：账本加厚

> Canonical breakdown: `docs/implementation/p2-ledger/README.md` and `docs/implementation/p2-ledger/00-roadmap.md`. This section is a milestone summary only; phase-specific ownership, schema, and verification details live under `docs/implementation/p2-ledger/`.

### 6.1 目标

把 `src/ledger/` 做成可信账户事实底座：只追加事件流、物理子账户归属、余额回放、对账、待归属兜底。

### 6.2 实施顺序

- [ ] P2-0 建立 `appendLedgerFacts()` 作为唯一账户源事实写入边界。
- [ ] P2-1 建立 mock/local import/cassette 离线数据通道。
- [ ] P2-2 建立远端 redacted export package。
- [ ] P2-3 建立 `exchange_account` / `api_credential` / `api_key_health_check` / `account_binding_audit` 基线、物理子账户自动归属、只读 Binance live sync。
- [ ] P2-4 建立纯函数回放、守恒校验、computed vs reported reconciliation。
- [ ] P2-5 建立外部交易、手工 attribution、reversal 兜底写入。
- [ ] P2-6 建立账本页 read model 与安全 action surface。
- [ ] P2-7 建立 remote ops、backup/restore-smoke、redaction、alerts。

### 6.3 验收标准

- 给定 fixture 账户事件，回放结果与预期持仓完全一致。
- 每笔策略内成交都有 `strategy_id` 和 `strategy_version`。
- 对账差异能被明确标记为 `MATCHED` / `MISSING_EVENT` / `EXTERNAL_BALANCE_MISMATCH` / `NEEDS_CLASSIFICATION`。
- 待归属队列在单策略正常路径下为空，但异常 fixture 会进入队列。
- 账本层不暴露任何账户事实给信号层。

## 7. P3：信号加厚

### 7.1 目标

把 `src/signal/facts/` 建成 Phase 1 市场事实库，并产生第一批启用态信号与决策时点快照。

### 7.2 实施顺序

- [ ] 建立市场事实 schema：
  - `market_kline`
  - `funding_rate_observation`
  - `open_interest_observation`
  - `long_short_ratio_observation`
  - `market_data_run`
- [ ] 建立信号 schema：
  - `signal_definition`
  - `signal_lifecycle_audit`
  - `signal_evaluation`
  - `decision_snapshot`
- [ ] 实现信号注册表：
  - `btc_trend_structure`
  - `eth_trend_structure`
  - `eth_btc_strength`
  - `funding_sentiment`
  - `open_interest_change`（观察态）
  - `long_short_crowding`（观察态）
- [ ] 实现 S0 启用态信号：
  - BTC 趋势结构
  - ETH 趋势结构
  - ETH/BTC 强弱
  - 资金费率温度
- [ ] 实现防抖和 `raw_value -> emitted_value`。
- [ ] 实现快照生成：
  - 活跃信号集
  - 各信号 version
  - raw / emitted value
  - 触发时间
  - 输入事实切片引用
- [ ] 实现站内信号动态：
  - 仅启用态信号的 `emitted_value` 切换触发。
  - 观察态只进快照和历史，不触发策略动作。

### 7.3 Binance 源优先级

- S0：Spot K 线，服务 BTC / ETH 趋势和 ETH/BTC 强弱。
- S1：funding rate，服务资金费率情绪。
- S2：open interest、long-short ratio，由 P1.5 先常驻采集；P3 接手后纳入快照观察区，不驱动策略。

### 7.4 验收标准

- 给定 fixture 市场事实，信号输出稳定且可重复。
- 策略层只能读取启用态信号集和 `snapshot_id`，不能读取 market facts。
- OI / 多空比即使未驱动策略，也能持续进入市场事实库和快照观察区。
- 快照能完整还原某个历史时点系统看见的输入和信号取值。

## 8. P4：策略引擎加厚

### 8.1 目标

实现 `src/strategy/` 的第一版决策引擎：策略对象、版本化、薄风险层、三层决策模型、计划动作。

### 8.2 实施顺序

- [ ] 建立策略 schema：
  - `strategy`
  - `strategy_version`
  - `strategy_lifecycle_audit`
  - `asset_pool`
  - `allocation_plan`
  - `planned_action`
- [ ] 建立 `docs/strategies/core_allocation_lt/README.md`：
  - 投资假设
  - 基准
  - 资产池
  - 风险层数值
  - 信号映射规则
  - 复盘口径
  - 版本历史
- [ ] 实现策略版本化：
  - 任一规则字段变更生成新版本。
  - 历史计划动作和成交按当时版本解释。
- [ ] 实现薄全局风险层：
  - 加密总投入上限
  - 稳定币最低保留比例
  - 单资产跨策略合计上限
- [ ] 实现风险暴露层：
  - `no_decision`
  - `defensive`
  - `observe`
  - `accumulate`
  - `rebalance_review`
- [ ] 实现结构配置层：
  - 由 `risk_regime`、ETH/BTC 强弱、资产池层级生成目标配置带。
- [ ] 实现执行动作层：
  - 由目标配置带和账本当前持仓生成 `planned_action`。
- [ ] 实现缺信号降级：
  - 核心信号缺失时输出 `no_decision`，不沿用旧值。

### 8.3 验收标准

- 策略层输入仅包含：
  - `ActiveSignalSet`
  - `snapshot_id`
  - ledger position / trade / cashflow views
  - strategy version
- 给定相同输入，策略输出完全确定。
- 每个 `planned_action` 都绑定 `snapshot_id + strategy_version`。
- 薄风险层一票否决，不被任何看多信号覆盖。
- Phase 1 只有一个运行态策略实例。

## 9. P5：前端加宽

### 9.1 目标

在 P1 已有最小市场页和账本页的基础上，把四个核心页面做成可用的工作台，不追求完整后台，不扩展 Phase 2 功能。

### 9.2 页面切片

- 市场页
  - 当前启用态信号集
  - 信号历史时间线
  - 快照查看器
  - 站内信号动态
- 账本页
  - 同步状态
  - 子账户绑定状态
  - 策略持仓
  - 成交流
  - 对账面板
  - 待归属队列
- 策略页
  - 单策略卡
  - 风险层状态
  - 当前计划动作
  - 目标配置带
  - 版本历史
- 复盘页
  - 待确认复盘草稿
  - 复盘五块：绩效、贡献、纪律、市场、建议
  - 确认流程
  - 历史归档

### 9.3 写操作边界

Phase 1 前端只允许四类写操作：

1. 确认复盘；
2. 归属交易；
3. 修改策略规则并生成新版本；
4. 维护资产池。

其它操作只读展示。外部推送配置、自动下单、信号在线增删改、绑定 UI 均不进入 Phase 1。

### 9.4 验收标准

- 页面所有颜色、状态、卡片、表格、动态条遵守 `design/数字资产投资操作系统_视觉说明.html`。
- 市场页的任意信号历史节点能打开快照查看器。
- 账本页任意成交能看到策略归属和 `snapshot_id`。
- 策略页能解释当前计划动作由哪些信号、规则、持仓推导而来。
- 复盘页确认后能跳转到策略规则修改，并生成新版本。

## 10. P6：绩效、偏离与复盘闭环

### 10.1 目标

把策略层从“能给计划动作”推进到“能判断做得好不好”，完成 Phase 1 的真正闭环。

### 10.2 实施顺序

- [ ] 实现 TWR：
  - 按策略级现金流切分子区间。
  - 子区间收益几何连乘。
- [ ] 实现 MWR：
  - 以现金流和期末市值计算资金实际收益。
- [ ] 实现 BTC 定投并持有基准：
  - 使用同一现金流时间线生成基准表现。
- [ ] 实现执行偏离：
  - 计划仓位偏离
  - 计划价格区间偏离
  - 计划时点偏离
  - 交易频率异常
- [ ] 实现周复盘草稿：
  - 绩效块
  - 贡献块
  - 纪律块
  - 市场块
  - 建议块
- [ ] 实现复盘确认：
  - 人确认结论。
  - 结论可触发策略规则修改。
  - 修改生成新策略版本。

### 10.3 验收标准

- TWR / MWR 与基准使用同一账本事实和同一现金流边界。
- 复盘草稿不调用 AI 做仓位建议、价格预测或决策结论。
- 每份复盘报告引用 `snapshot_id + strategy_version`。
- 至少一条 fixture 能演示：复盘结论 -> 修改策略规则 -> 新版本生效。

## 11. P7：真实 Binance 接入与运行硬化

### 11.1 目标

把 fixture 驱动的闭环切到真实 Binance 只读数据，并具备长期低频运行能力。P7 负责完整实测和硬化，不再承担 OI / 多空比影子采集的首次启动责任。

### 11.2 实施顺序

- [ ] 在非限制区环境实测 Binance 行情接口：
  - `GET /api/v3/klines`
  - `GET /fapi/v1/fundingRate`
  - P1.5 已运行的 `futures/data/*` 采集器字段、限频、分页与错误处理复核
- [ ] 在非限制区环境实测 Binance 账户接口：
  - `GET /sapi/v1/account/apiRestrictions`
  - `GET /sapi/v1/sub-account/list`
  - `GET /api/v3/account`
  - `GET /api/v3/myTrades`
  - `GET /api/v3/allOrders`
  - 充提 / 主子账户划转历史接口
- [ ] 实现 Binance client：
  - public market client
  - signed account client
  - request signing
  - rate limit budget
  - retry and backoff
  - response normalization
- [ ] 实现同步调度：
  - 市场事实低频轮询
  - P1.5 影子采集器并入统一运行状态
  - 账户事实手工即时同步
  - 账户事实低频兜底同步
- [ ] 实现运行状态：
  - last successful run
  - error summary
  - freshness
  - restricted location detection
  - credential health status
- [ ] 实现备份与恢复演练：
  - database backup
  - restore drill
  - fixture replay comparison
  - 首次真实账户同步前必须完成一次 restore drill

### 11.3 验收标准

- 真实 Binance 同步只使用只读权限，不触发 `TRADE`、提现、真实划转。
- 日志不打印 key、secret、header、签名原文、账户敏感余额细节。
- 地理限制错误能被识别为数据连通性问题，而不是策略或信号失败。
- P1.5 启动的 OI / 多空比短保留数据采集仍持续落库，并进入统一运行状态。
- 首次真实账户同步前已有可恢复的数据库备份。
- 断网 / API 错误 / 限频后，系统能重试并保持游标正确。

## 12. 并行与分支策略

P0 完成前禁止并行业务实现。P0 完成后可按以下 owner 拆分；P1 与 P1.5 可在不同 owner 下并行，但 P1 是 6–8 周 go/no-go 主线，P1.5 是保护短历史数据的旁路任务。

| Owner | 分支示例 | 目录边界 | 任务 |
| --- | --- | --- | --- |
| ledger agent | `ledger/phase1-event-log` | `src/ledger/`、账本测试、账本页 API | 账户事件流、回放、对账、Binance 账户同步 |
| signal agent | `signal/phase1-facts-signals` | `src/signal/`、市场页 API | 市场事实库、信号注册表、快照、站内动态、P1.5 影子采集器 |
| strategy agent | `strategy/core-allocation-v0` | `src/strategy/`、策略测试、策略档案 | 策略对象、资产池、风险层、计划动作、绩效复盘 |
| frontend agent | `app/phase1-workbench` | 前端页面与视觉组件 | P1 最小市场页/账本页，P5 补齐策略页/复盘页 |
| docs agent | `docs/phase1-contracts` | `docs/` | ADR、接口文档、验收文档 |

任何跨层 DTO、schema、接口变更都必须先写 ADR 或更新 `docs/api/phase1-contracts.md`，再通知相关 owner。

## 13. 推荐提交节奏

每个阶段应拆成小提交：

1. schema / contract；
2. failing tests / fixtures；
3. minimal implementation；
4. page or API wiring；
5. docs update；
6. verification.

提交信息格式遵守 `AGENTS.md`：

```text
<scope>: <做了什么>

<为什么做>

Generated by Codex
```

## 14. Phase 1 不做清单

以下内容在 Phase 1 期间不得顺手实现：

- 自动下单；
- 自动划转；
- 任何 `TRADE` endpoint；
- 提现权限；
- 合约 / 杠杆 / 做空 / 期权交易；
- 外部 IM 推送；
- 非 Binance 数据源；
- AI 自动决定信号、阈值、仓位、策略规则；
- 纸面策略与小仓验证；
- 多策略调度；
- 通用信号在线编辑器；
- 绑定 / 换 key 的完整管理 UI。

## 15. 主要风险与处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| 技术栈迟迟不定 | 后续实现无法验证 | P0 设为第一阻塞项，完成前不写业务代码 |
| 6–8 周骨架跑不通 | 项目价值和执行风险不明 | P0 + P1 作为 go/no-go 闸门，失败即触发项目级复盘 |
| Binance 出口地区受限 | 真实同步不可用 | 本地 fixture 先行；一旦有非限制区出口，先启动 P1.5 public collector |
| OI / 多空比历史短 | 无法回测 | P1.5 单拆常驻采集，P3 再纳入快照观察区 |
| Postgres 迁移延迟 | 事实数据未来迁移风险高 | P0 直接定 PostgreSQL，本地和 CI 都用 Postgres |
| 账本漏现金流 | TWR/MWR 失真 | P2 优先完成 capital flow 与对账，不先做漂亮页面 |
| 策略绕过信号直接读行情 | 复盘失真 | P0 契约和测试禁止 strategy import signal facts / Binance client |
| 前端写操作膨胀 | 范围失控 | P5 只允许四类写操作，其余只读 |
| 复盘变成展示页 | 闭环失败 | P6 要求确认复盘后能触发策略新版本 |
| 首次真实同步无备份 | 不可丢失事实数据暴露 | P7 首次真实账户同步前必须完成备份与恢复演练 |

## 16. 建议的执行顺序

1. 先执行 P0，产出技术栈 ADR、跨层契约 ADR、验证门；PostgreSQL、worker / 调度、备份策略和 ADR-0007 唯一契约权威必须在此定死。
2. 执行 P1，用 fixture 做完整闭环，并交付最小市场页 + 账本页；P0 + P1 合计受 6–8 周时间盒约束。
3. 若已有非限制区出口，P1.5 在 P0 后尽早启动，与 P1 并行保护 OI / 多空比历史。
4. P2 与 P3 并行加厚，但每周做一次 contract sync。
5. P4 在 P2/P3 的 mock contract 稳定后启动。
6. P5 在 P1 最小 UI 基础上加宽策略页和复盘页，不等待真实 Binance。
7. P6 在 P4 计划动作稳定后启动。
8. P7 最后统一做真实 Binance 账户接入、完整行情实测、调度硬化和备份恢复演练。

## 17. 下一步

下一步应先创建 P0 的实施分支，例如：

```bash
git checkout -b docs/phase1-technical-baseline
```

然后完成两份 ADR：

- `docs/decisions/0006-phase1-technical-baseline.md`
- `docs/decisions/0007-phase1-cross-layer-contracts.md`

P0 合入后，再把 P1 拆成真正的代码级 implementation plan。
