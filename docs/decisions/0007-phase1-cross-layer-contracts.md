# ADR-0007: Phase 1 跨层契约基线

- 状态：Accepted
- 日期：2026-06-19
- 决策者：hashmike + Codex
- 涉及层：全局（ledger / signal / strategy）

## 背景

项目三层边界已经明确：账本层回答「发生了什么」，信号层回答「市场是什么状态」，策略层回答「基于判断该做什么」。AGENTS.md 规定「先冻结契约，再并行开工」；立项书与三层 PRD 也反复强调可复盘、可证伪、可淘汰。

在进入 P0/P1 实现前，需要把散落在总 PRD、账本 PRD、信号 PRD、策略 PRD 中的跨层契约收口到唯一权威入口。否则不同 agent 很容易各自解释「快照」「活跃信号」「策略持仓」「资产池」「信号事实库」这些概念，最后在集成时才发现边界互相穿透。

本 ADR 只冻结 Phase 1 的跨层契约与所有权。具体字段的数据库迁移、TypeScript 类型和 fixture 在 P0/P1 代码落地时实现；若实现发现需要改契约，必须先写新 ADR 或修订本 ADR。

## 决策

### 1. 本 ADR 是 Phase 1 跨层契约唯一权威

- PRD 负责解释产品意图，本 ADR 负责约束 Phase 1 跨层接口与所有权。
- 若 PRD、实施计划、代码注释与本 ADR 冲突，以本 ADR 为准；要改本 ADR，必须新增或修订 ADR，不得在代码里静默绕开。
- P0 实现时可补充 `docs/api/phase1-contracts.md`，用于承载精确 TypeScript 类型、JSON 示例和 fixture；该文件不得改变本 ADR 的边界，只能展开细节。

### 2. 跨层依赖方向固定

- **strategy 消费 signal**：只消费 `ActiveSignalSet` 与 `SignalSnapshotRef`；不得直接读原始行情、signal facts 表、Binance client 或指标计算实现。
- **strategy 消费 ledger**：只消费策略归属后的账本视图，如 `LedgerPositionView`、`LedgerTradeView`、`CapitalFlowView`、`AccountBindingStatus`。
- **ledger 引用 strategy**：只引用 `StrategyVersionRef` 与 `StrategyBindingRef`，用于成交归属、版本追溯和子账户绑定；ledger 不解释策略规则。
- **ledger 承载快照容器，signal 产出快照内容**：ledger 负责 `snapshot_id`、存储、取回、不可变性；signal 负责该快照里市场判断的内容。
- **signal 不依赖账户事实库**：signal 层对账本账户、持仓、成交、资金流零依赖。
- **frontend / BFF 面向服务契约**：页面展示 `StrategyCard`、`PlannedAction`、`ReviewDraft`、账本页和市场页的只读视图；不得绕开服务层直接拼跨层 SQL。

### 3. 市场事实库归 signal/facts

- 市场事实库属于信号层，模块路径约定为 `src/signal/facts/`。
- Phase 1 只接 Binance 来源数据；非 Binance 价格、链上、宏观、社媒等数据源延后。
- facts 只保存市场事实与采集元数据，不保存账户、持仓、策略资金、执行偏离等账本 / 策略事实。
- facts 可被 signal 内部指标与信号评估读取；strategy 只能看到评估后的启用态信号与快照引用。

### 4. 资产池归 strategy，账本只消费同步符号集

- `AssetPool` owner 为 strategy。它描述某个策略版本允许研究 / 配置的资产范围、角色与约束。
- 骨架期默认资产池：`USDT`、`BTC`、`ETH`、`SOL`、`BNB`。
- `AssetPool` 最小字段：`strategy_id`、`strategy_version`、`asset`、`role`、`status`、`effective_from`、`effective_to`。
- `role` 初始枚举：`stable`、`core`、`satellite`、`fee_asset`。其中 `USDT=stable`、`BTC/ETH=core`、`SOL=satellite`、`BNB=fee_asset`。
- `SyncSymbolSet` 由 strategy 从 `AssetPool` 派生给 ledger 使用，骨架期为：`BTCUSDT`、`ETHUSDT`、`SOLUSDT`、`BNBUSDT`。
- signal 的市场观察 universe 独立归 signal 管理，不从 `AssetPool` 反向派生。比如 `ETHBTC` 可作为信号层市场事实，不要求进入账本同步符号集。

### 5. 快照拆成容器与内容

- `DecisionSnapshotContainer` owner 为 ledger，最小字段：
  - `snapshot_id`
  - `schema_version`
  - `created_at`
  - `created_by`
  - `content_hash`
  - `content_ref` 或 `content_json`
  - `immutability_state`
- `SignalSnapshotContent` owner 为 signal，最小字段：
  - `snapshot_id`
  - `evaluated_at`
  - `active_signal_set`
  - `input_refs`
  - `data_health`
  - `schema_version`
- ledger 保证快照按 `snapshot_id` 存取与不可变；signal 保证内容可解释、可复算、可证伪。
- P1 的快照内容可以很薄，但必须足够让 strategy 重放「当时看见了哪些启用态信号」。

### 6. Phase 1 核心契约对象

`ActiveSignalSet`

- owner：signal
- 消费方：strategy
- 最小字段：`snapshot_id`、`as_of`、`signals[]`、`data_health`
- `signals[]` 元素字段：`signal_id`、`signal_version`、`lifecycle_state`、`value`、`raw_value`、`evaluated_at`、`reason_codes`
- 只有 `lifecycle_state=enabled` 的信号进入该集合。

`SignalSnapshotRef`

- owner：ledger + signal
- 消费方：strategy / review
- 最小字段：`snapshot_id`、`created_at`、`schema_version`、`content_hash`

`LedgerPositionView`

- owner：ledger
- 消费方：strategy / frontend
- 最小字段：`strategy_id`、`strategy_version`、`as_of`、`assets[]`
- `assets[]` 元素字段：`asset`、`free_qty`、`locked_qty`、`total_qty`、`cost_basis_quote`

`LedgerTradeView`

- owner：ledger
- 消费方：strategy / review
- 最小字段：`trade_id`、`exchange_account_id`、`strategy_id`、`strategy_version`、`snapshot_id`、`symbol`、`side`、`price`、`qty`、`commission_asset`、`commission_qty`、`time`

`CapitalFlowView`

- owner：ledger
- 消费方：strategy / review
- 最小字段：`event_id`、`strategy_id`、`flow_type`、`asset`、`amount`、`event_time`、`source_account`、`target_account`

`AccountBindingStatus`

- owner：ledger
- 消费方：strategy / ops UI
- 最小字段：`strategy_id`、`exchange_account_id`、`binding_state`、`credential_health`、`last_checked_at`、`blocking_reasons`
- 不暴露 secret；必要时只暴露 `key_ref`。

`StrategyBindingRef`

- owner：strategy + ledger
- 消费方：ledger / ops UI / review
- 最小字段：`strategy_id`、`strategy_version`、`exchange_account_id`、`binding_state`、`effective_from`、`effective_to`
- 用于表达「某策略版本在某时间段绑定哪个物理子账户」，不承载策略规则。

`StrategyVersionRef`

- owner：strategy
- 消费方：ledger / review
- 最小字段：`strategy_id`、`strategy_version`、`effective_from`、`effective_to`、`status`

`PlannedAction`

- owner：strategy
- 消费方：frontend / review
- 最小字段：`action_id`、`strategy_id`、`strategy_version`、`snapshot_id`、`action_type`、`target_allocation_band_ref`、`reason_codes`、`created_at`、`status`
- Phase 1 只生成操作建议 / 计划视图，不自动下单。

`ReviewDraft`

- owner：strategy
- 消费方：frontend
- 最小字段：`review_id`、`strategy_id`、`strategy_version`、`period_start`、`period_end`、`snapshot_refs`、`sections`、`status`
- AI 仅可润色草稿文字，不产生仓位建议、择时判断或策略规则修改。

### 7. 值类型与枚举约定

- 跨层 DTO 的财务数值一律用 decimal string；不得用 JS `number` 表示价格、数量、金额、成本、费用。
- 时间字段统一为 UTC ISO 8601 字符串；展示层再按本地时区格式化。
- ID 使用稳定字符串或 UUID；不要用自增 id 作为跨层公共引用。
- 代码枚举用英文稳定值；前端文案可映射为中文。
- 关键状态最小集合：
  - 信号生命周期：`shadow`、`watching`、`enabled`、`disabled`、`retired`
  - 绑定状态：`active`、`warn`、`blocked`
  - 策略版本状态：`draft`、`active`、`superseded`、`retired`
  - 计划动作状态：`draft`、`confirmed`、`dismissed`、`executed_manually`

### 8. 导入边界与测试约束

- `src/strategy/` 可以导入共享契约类型与 strategy 自己的配置，不得导入 `src/signal/facts/`、Binance client、行情仓储或 signal 内部指标实现。
- `src/signal/` 不得导入 ledger 的账户、持仓、成交、现金流模块。
- `src/ledger/` 可以引用 `StrategyVersionRef` / `StrategyBindingRef`，不得导入策略规则引擎。
- P1 必须有跨层 fixture 测试：给定账本视图 + 启用态信号快照，strategy 可生成可追溯 `PlannedAction` 或空动作，且输出包含 `snapshot_id` 与 `strategy_version`。
- 任一跨层字段变更必须同步更新 ADR / API 文档 / fixture，不允许只改一侧代码。

## 备选方案

- **继续把契约散落在三份 PRD 中**：不选。PRD 适合讲意图，不适合作为实现期唯一接口约束；散文契约会导致多 agent 集成冲突。
- **策略直接读市场事实库**：不选。违背总 PRD 与 ADR-0005，复盘时会绕开信号生命周期和快照。
- **信号层消费账户事实或资产池**：不选。信号层必须保持市场判断独立；资产池归 strategy，账本同步符号集只是 strategy 给 ledger 的派生输入。
- **ledger 拥有快照内容**：不选。ledger 只保证容器和不可变性；市场判断内容归 signal，否则账本层会被迫理解市场维度。
- **前端按页面自定义接口拼装**：不选。会把跨层契约隐藏在页面代码里，破坏可验证与并行实现。

## 影响

- P0/P1 实现前，跨层 schema、DTO、fixture 必须按本 ADR 收口。
- 总 PRD、账本 PRD、信号 PRD、策略 PRD 如有契约描述，应引用本 ADR，不再各自扩写相互矛盾的接口。
- 资产池成为 strategy 的命名交付物；账本只消费 `SyncSymbolSet`，signal 不消费资产池。
- 市场事实库成为 signal 的命名交付物，路径归 `src/signal/facts/`。
- 骨架期 P1 必须同时具备最小快照容器与最小快照内容，否则策略层无法完成可复盘闭环。
