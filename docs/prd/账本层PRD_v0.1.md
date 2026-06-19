# 账本层 PRD（事实层 · 账户事实库）v0.1

> 文档定位：三份子 PRD 之一，展开事实层中「账户事实库」子域 + 同步基础设施 + 决策时点快照的存储机制。
>
> 上游文档：《数字资产投资操作系统_总PRD_v0.1》§3.1；《数字资产投资项目立项计划书_v0.2》§5。
> 决策依据：`docs/decisions/0003-ledger-account-model-and-sync-architecture.md`（账户模型与同步架构）。
> 数据源依据：`docs/research/binance-account-api-research.md`（Binance 账户/同步 API 调研）。
>
> 本版范围：第 0–8 章（定位与边界、核心数据模型、同步管道、绑定功能、待归属队列、对账、外部录入、备份与保留、账本页前端）全部完成。开放问题与待办见 §9。

---

## 第 0 章 定位与边界

### 0.1 账本层职责

账本层回答一个问题：**「账户里到底发生了什么、现在有什么」——并且账对不对。** 验收标准 = 账对不对（系统算出的余额对得上交易所实际余额）。

它包含三块：

1. **账户事实库**：成交、充值、提现、划转及其它会改变余额的资产变动，作为只追加的事件流。
2. **同步基础设施**：Binance 只读 API 客户端、限频管理、定时调度、失败重试、幂等、断点续跑。
3. **决策时点快照的存储机制**：快照的容器与按 ID 取回（快照**内容**由信号层定义，见 0.3）。

### 0.2 三条红线（不可绕过）

1. **只追加、不可变**：账户事实一旦入库不可修改、不可删除；纠错只能追加**冲正（reversal）**事件。
2. **判断层零依赖**：账本层数据**只服务决策层**；判断层（信号层）对账户事实库零依赖——市场信号研判不得受个人持仓影响。
3. **只读、密钥不入库**：Phase 1 仅用只读 API（无交易、无提现权限）；明文密钥永不进 git、不进 DB、不进日志（见 ADR-0003）。

### 0.3 层间接口（契约）

| 方向 | 账本层提供 / 消费 | 说明 |
| --- | --- | --- |
| → 决策层 | **策略归属的持仓与成交**（按 策略 + 版本） | 决策层据此算 TWR/MWR、对基准、再平衡 |
| → 决策层 | **现金流事实**（充提 + 主↔子划转） | 绩效计算的入账依据；账本只记事实，不算 TWR/MWR |
| ↔ 信号层 | 决策时点快照的**容器**（存储 + 按 `snapshot_id` 取回） | 快照**内容**（市场输入维度）由信号层定义；账本不解释内容 |
| ← 信号层 | 写入快照 | 信号层每次状态判定产出快照，存入账本容器 |
| 内部 | 成交 ↔ `snapshot_id` 绑定 | 复盘可还原成交发生时的市场判断依据 |

> 红线重申：账本层**不向信号层暴露任何账户数据**。

### 0.4 范围（Phase 1）

**做**：Binance 只读同步（成交/充提/划转及其它会改变余额的资产变动）、物理子账户归属 + 虚拟兜底 v0、快照容器 v0、API key 绑定与安全体检、对账、外部交易手工录入。

**不做**（Phase 1）：自动下单、自动划转（`POST` 类接口）、合约/杠杆/期权、税务处理、纸面策略的纯虚拟模拟账本（推迟到 Phase 2）。

---

## 第 1 章 核心数据模型

### 1.1 心智模型

> **唯一的事实是「事件流」；「账户」和「策略归属」是同一批事件投影出的两个维度——一个用来对账，一个用来复盘。持仓 / 余额都是算出来的派生视图，永远不是源数据。**

因 ADR-0003 采用**物理子账户**（1 实盘策略 = 1 Binance 子账户），两个维度在交易所内天然合一：成交发生在哪个子账户，就归属哪个策略。归属几乎「白送」，软件虚拟切分降级为外部钱包 / 纸面策略的兜底能力。

账户拓扑：

```
主账户 master   = 未分配资金池 / 稳定币总储备 / 入金口（不交易）
子账户 1..5     = 策略 1..5（物理隔离；Phase 1 仅激活 1 个）
外部钱包 0..n   = 链上 / 系统外持仓（手工归属）
```

### 1.2 实体总览

| 实体 | 角色 | 性质 |
| --- | --- | --- |
| `exchange_account` | 主/子账户映射 | 配置 |
| `api_credential` | API key 的**引用**（不存明文） | 配置 |
| `api_key_health_check` | key 权限体检结果 | 只追加 |
| `account_binding_audit` | 策略↔子账户↔key 绑定/解绑/换key 历史 | 只追加 |
| `exchange_trade_fill` | 成交事实 | 只追加 · 源数据 |
| `exchange_order` | 订单事实（解释执行偏离） | 只追加 · 源数据 |
| `capital_flow_event` | 非成交的资产变动（充提/划转/Convert/Dust/Dividend/钱包划转） | 只追加 · 源数据 |
| `external_trade` | 系统外（外部钱包）交易手工录入 | 只追加 · 源数据 |
| `attribution_record` | 人工归属记录（事件 → 策略 + 版本） | 只追加 |
| `reversal`（事件标记） | 冲正：任一源数据事件的反向纠错 | 只追加 |
| `decision_snapshot` | 决策时点快照容器 | 只追加 |
| `lot` | 持仓批次（成本基础载体） | 派生（回放算出） |
| `position`（视图） | 策略 × 资产 当前持仓 | 纯派生 |
| `balance`（视图） | 账户 × 资产 当前余额 | 纯派生 |
| `account_balance_snapshot` | 定期从交易所拉取的余额（对账目标） | 只追加 |
| `reconciliation_result` | 每次对账的差异结果 | 只追加 |
| `sync_cursor` | 断点续跑游标 | 状态 |

> 命名澄清：`account_balance_snapshot`（对账用的余额拉取）≠ `decision_snapshot`（决策时点的市场输入快照）。二者无关。

### 1.3 事件 taxonomy（完整）

所有改变持仓 / 余额的事实，统一归为「事件」。物理上：成交进 `exchange_trade_fill`（需 lot/成本细节），其余进 `capital_flow_event`，外部交易进 `external_trade`。

| 概念事件 | 物理表 | 账户维度 | 策略维度 | 跨系统边界 | 来源 API |
| --- | --- | --- | --- | --- | --- |
| 成交 trade | `exchange_trade_fill` | 子账户 −quote +base（买） | 策略 −quote +base（新 lot） | 否 | `GET /api/v3/myTrades` |
| 充值 deposit | `capital_flow_event` | +账户 | +未分配池 | **入** | `deposit/subHisrec`、`deposit/hisrec` |
| 提现 withdrawal | `capital_flow_event` | −账户 | −策略/池 | **出** | `capital/withdraw/history` |
| 划转 transfer | `capital_flow_event` | 账户 A→B | 主↔子=策略注资/撤资 | 否 | `sub-account/universalTransfer` 等 |
| 闪兑 Convert | `capital_flow_event` | −fromAsset +toAsset | 同账户内换形 | 否 | `convert/tradeFlow` |
| 小额兑换 Dust | `capital_flow_event` | −小额资产 +BNB | 同上 | 否 | `asset/dribblet` |
| 分红/空投 Dividend | `capital_flow_event` | +资产 | +对应策略 | 否（外部入账） | `asset/assetDividend` |
| 钱包划转 Wallet-transfer | `capital_flow_event` | Spot↔Funding↔Earn | 不变 | 否 | `asset/transfer` |
| 外部交易 external | `external_trade` | 外部钱包 | 手工归属 | 视情况 | 人工录入 |
| 冲正 reversal | 各源表 | 反向 | 反向 | — | 系统/人工 |

> 为什么必须收全 Convert/Dust/Dividend/Wallet-transfer：它们都会改余额，漏记则守恒不变式（§1.5）对账永远不平。

### 1.4 实体字段

> 字段沿用 API 调研已定义者，并补齐系统内字段（标 ★）。类型在技术栈确定后细化（§9）。

**1.4.1 `exchange_account`**

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `id` ★ | 本地 ID | 系统 |
| `exchange` | `BINANCE` | 枚举 |
| `account_role` | `MASTER` / `SUB_ACCOUNT` / `EXTERNAL_WALLET` | 枚举 |
| `sub_user_id` | 子账户 ID | `sub-account/list.subUserId` |
| `email` | 子账户邮箱/虚拟邮箱 | `sub-account/list.email` |
| `remark` | Binance 备注 | `sub-account/list.remark` |
| `local_label` ★ | 本地可编辑昵称（独立于 Binance `remark`） | 用户维护 |
| `is_freeze` | 是否冻结 | `sub-account/list.isFreeze` |
| `bound_strategy_id` ★ | 绑定策略 | 系统维护 |
| `created_at_exchange` | Binance 创建时间 | `createTime` |

> 展示优先级：**已绑定策略的子账户，展示名以 `strategy.name` 为权威**；`local_label` 用于主账户、外部钱包、以及未绑定 / 绑定前的子账户，并作为兜底。避免「账户昵称 vs 策略名」两套名字冲突。

**1.4.2 `api_credential` ★（新）**

| 字段 | 说明 |
| --- | --- |
| `id` | 本地 ID |
| `exchange_account_id` | 所属账户 |
| `credential_role` ★ | `MASTER_READ_ONLY` / `STRATEGY_SUB_READ_ONLY` |
| `key_label` | 人类可读标签 |
| `key_ref` | **指向 `.env` 的环境变量前缀**（如 `BINANCE_STRATEGY_CORE_ALLOCATION_LT`）；不存明文 |
| `scope` | 固定 `READ_ONLY` |
| `status` | `active` / `blocked` / `revoked` |
| `last_verified_at` | 上次体检时间 |

**1.4.3 `api_key_health_check`**

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `exchange_account_id` | 所属账户 | 系统 |
| `checked_at` | 检查时间 | 系统 |
| `ip_restrict` | 是否 IP 限制 | `apiRestrictions.ipRestrict` |
| `enable_reading` | 是否可读 | `apiRestrictions.enableReading` |
| `enable_withdrawals` | 是否可提现 | `apiRestrictions.enableWithdrawals` |
| `enable_spot_and_margin_trading` | 是否可交易 | `apiRestrictions.enableSpotAndMarginTrading` |
| `enable_internal_transfer` | 是否内部划转 | `apiRestrictions.enableInternalTransfer` |
| `permits_universal_transfer` | 是否 universal transfer | `apiRestrictions.permitsUniversalTransfer` |
| `risk_level` | `OK` / `WARN` / `BLOCK` | 系统判定 |

> 安全闸门（绑定时卡死 + 定期复检）：`enable_reading=true`、`enable_withdrawals=false`、`enable_spot_and_margin_trading=false` 任一不满足 → `BLOCK`；`ip_restrict=false` → `WARN`。

**1.4.4 `account_binding_audit` ★（新，只追加）**

| 字段 | 说明 |
| --- | --- |
| `id` | 本地 ID |
| `action` | `BIND` / `UNBIND` / `ROTATE_KEY` / `REBIND_STRATEGY` |
| `strategy_id` / `exchange_account_id` / `api_credential_id` | 涉及三元组 |
| `actor` | 操作者（人/agent） |
| `occurred_at` | 时间 |
| `note` | 原因 |

**1.4.5 `exchange_trade_fill`**

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `exchange_account_id` | 子账户 | 系统 |
| `strategy_id` ★ | 绑定策略 | 子账户绑定推导 |
| `strategy_version` ★ | 成交时策略版本 | 系统（按 `time` 取当时版本） |
| `snapshot_id` ★ | 成交时点生效的决策快照（无则空） | 系统绑定 |
| `symbol` | 交易对 | `myTrades.symbol` |
| `trade_id` | Binance trade id | `id` |
| `order_id` | Binance order id | `orderId` |
| `price` / `qty` / `quote_qty` | 成交价/base量/quote量 | 同名 |
| `commission` / `commission_asset` | 手续费 | 同名 |
| `time` | 成交时间（occurred_at） | `time` |
| `is_buyer` / `is_maker` | 方向/maker | 同名 |
| `raw_payload` | 原始响应 | 原样存储 |

幂等键：`exchange_account_id + symbol + trade_id`。

**1.4.6 `exchange_order`**（字段见 API 调研 §5.4；用途：解释计划价 vs 实际成交、挂单/撤单等执行偏离。订单非持仓主事实，成交 fill 才是。）

**1.4.7 `capital_flow_event`**

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `exchange_account_id` | 发生账户 | 系统 |
| `strategy_id` ★ | 若可归属则填 | 系统推导 |
| `event_type` | `MASTER_SUB_TRANSFER`/`SUB_DEPOSIT`/`MASTER_DEPOSIT`/`WITHDRAW`/`WALLET_TRANSFER`/`CONVERT`/`DUST`/`DIVIDEND` | 枚举 |
| `external_id` | Binance 记录 ID / tranId / orderId | 各接口 |
| `asset` | 资产 | 各接口 |
| `amount` | 数量，**流入为正、流出为负** | 系统标准化 |
| `fee_asset` / `fee_amount` | 手续费 | 提现/Convert/Dust |
| `from_account` / `to_account` | 来源/目标账户 | 划转接口 |
| `network` / `tx_id` | 链网络/链上 ID | 充提 |
| `event_time` | 账本时间 | 各接口时间字段 |
| `status` | 原始状态（只入账成功） | 各接口 |
| `raw_payload` | 原始响应 | 原样存储 |

幂等键：`exchange_account_id + event_type + external_id`。

**1.4.8 `external_trade` ★（新，外部钱包手工录入）**

最小字段集：`id · wallet_account_id · strategy_id · side · base_asset · quote_asset · base_qty · quote_qty · price · fee_amount/asset · occurred_at · note · entered_by`。

**1.4.9 `decision_snapshot`**

| 字段 | 说明 |
| --- | --- |
| `snapshot_id` | 唯一 ID（成交/状态判定引用） |
| `captured_at` | 生成时间 |
| `content_ref` | 内容存档指针（内容 schema 由信号层定义） |

**1.4.10 `lot`（持仓批次，FIFO）**

| 字段 | 说明 |
| --- | --- |
| `lot_id` | 批次 ID |
| `strategy_id` / `asset` | 归属策略 / 资产（base） |
| `open_event_id` | 建仓的 buy fill |
| `qty_opened` / `qty_remaining` | 开仓量 / 剩余量 |
| `unit_cost` | 单位成本（含手续费摊销） |
| `opened_at` / `snapshot_id` | 开仓时间 / 快照 |

卖出按 `opened_at` 升序（FIFO）扣减 `qty_remaining`，产生已实现盈亏。

**1.4.11 派生视图**

- `position`（策略 × 资产）：`qty` = 该 (策略, 资产) 的事件净额（含计价货币现金腿）；对需成本基础的资产，另由 `lot` 给出 `avg_cost`、已实现 / 未实现盈亏，且其 `qty` 应等于 Σ`lot.qty_remaining`（一致性校验）。
- `balance`（账户 × 资产）：由事件流回放算出；用于对账。

**1.4.12 `sync_cursor` / `account_balance_snapshot`**：字段见 API 调研 §5.7 / §5.3。

### 1.5 守恒不变式

对任意资产：

```
Σ(各账户 computed 余额) = Σ(各策略持仓) + 主账户未分配     （按每个资产分别成立）
```

- 左边对比 `account_balance_snapshot`（交易所实际）= **对账**；
- 右边要求每一单位都有归属，无法归属则挂「主账户未分配」= **归属完整性**。
- **策略持仓含计价货币（USDT / 稳定币）现金腿**；`lot` 仅是「需成本基础资产」的额外结构，对这类资产其持仓量应等于 Σ该资产 `lot` 剩余（一致性校验）。
- 两边不平 → 有事件漏记（典型：Convert/Dust/Dividend/钱包划转未同步）或归属错误。

### 1.6 派生原则与持仓计算（Phase 1 决策）

账户余额、策略持仓、lots、成本、盈亏**全部由事件流全量回放（replay）现算**，源头永远是事件流，不持久化为派生表。

- 计算收敛为一个**纯函数** `compute(events, asOf) → {balance, lots, position}`：按 `occurred_at` 排序（`trade_id` / `event_id` 兜底），fold 出截至 `asOf` 的账面。任意历史时点账面 = 把 `asOf` 设为该时刻。
- 摄入需**幂等去重**（按各表幂等键），使纯函数对乱序到达、重复拉取天然稳定——这是全量回放相对增量投影的关键正确性优势。
- **Phase 1 不做投影表、不做内存缓存、不做状态检查点。** 理由：本项目量级（个人现货中长期，年成交数百~千条，多年累计低万级事件）下全量回放为毫秒级，且对账（§1.5）本就要全量聚合；增量投影叠加 FIFO 对乱序敏感，复杂度与正确性风险不划算。
- **再评估触发条件**：事件量级显著上升（如 10 万级且热路径频繁重算），或出现实时高频读取时，再考虑加内存记忆化或物化投影；届时纯函数已在，后加为低风险缓存。

---

## 第 2 章 Binance 同步管道

### 2.1 定位与目标

把 Binance 账户事实**只读**拉进事件流（第 1 章三表）。四条硬目标：

1. **完整**：不漏事件（含 Convert / Dust / Dividend / 钱包划转，否则对账不平）。
2. **幂等**：重复拉取不重复入账。
3. **可断点续跑**：游标持久化，中断可继续。
4. **守限频**：不触发 Binance 限频封禁。

输入 = 第 3 章路由表；输出 = `exchange_trade_fill` / `exchange_order` / `capital_flow_event` + `account_balance_snapshot` + `sync_cursor`。

### 2.2 同步对象 → 接口 → 约束（对齐第 1 章 taxonomy + 第 3 章路由）

| 同步对象 | 接口 | 用的 key | 时间窗口 / 游标约束 |
| --- | --- | --- | --- |
| 成交 | `GET /api/v3/myTrades` | 子账户 | **按 symbol**；`fromId` 游标优先；时间窗口 ≤ 24h；limit 1000 |
| 订单 | `GET /api/v3/allOrders` | 子账户 | 按 symbol；`orderId` 或 ≤ 24h；limit 1000 |
| 子账户余额 | `GET /api/v3/account` / `sapi/v3/sub-account/assets` | 子账户 / master | 当前快照，无历史 |
| 主子划转 | `GET /sapi/v1/sub-account/universalTransfer` | master | 窗口 < 7 天；limit 500 |
| 子账户充值 | `GET /sapi/v1/capital/deposit/subHisrec` | master | — |
| master 充值 | `GET /sapi/v1/capital/deposit/hisrec` | master | 默认 90 天；窗口 < 90 天 |
| 提现 | `GET /sapi/v1/capital/withdraw/history` | master | 默认 90 天；窗口 < 90 天 |
| 钱包划转 | `GET /sapi/v1/asset/transfer` | 各账户 | 仅近 6 月；默认近 7 天 |
| Convert | `GET /sapi/v1/convert/tradeFlow` | 各账户 | 窗口 ≤ 30 天 |
| Dust | `GET /sapi/v1/asset/dribblet` | 各账户 | 仅近 100 条 |
| Dividend | `GET /sapi/v1/asset/assetDividend` | 各账户 | 窗口 ≤ 180 天 |
| symbol 字典 | `GET /api/v3/exchangeInfo` | 公开 | 校准 serverTime |

> 数值依据 `docs/research/binance-account-api-research.md`，并以 API 实测为准。

### 2.3 symbol 清单（关键约束）

`myTrades` / `allOrders` **必须按 symbol 查询**，没有任何官方接口能一次返回整账户全部成交。因此：

1. 从**策略资产池**推导候选交易对（如 BTC/ETH/SOL × USDT）；
2. 用 `exchangeInfo` 校验有效性与精度，建本地 symbol 字典；
3. 对每个子账户 × 每个 symbol 拉取。

> **漏 symbol = 漏成交**。兜底：对账不平时，扩大 symbol 扫描范围或提示人工补充交易对。

### 2.4 首次 backfill 顺序（见调研 §6.1）

1. master key 调 `sub-account/list` 建立账户列表（第 3 章发现）。
2. 绑定策略 ↔ 子账户、录入只读 key、过安全体检。
3. 拉各子账户当前余额（`account` / `sub-account/assets`）。
4. 建 symbol 字典（§2.3）。
5. 每子账户 × 每 symbol：`myTrades` + `allOrders`。
6. 拉资金流：主子划转、子充值、master 充值、提现、（Convert / Dust / Dividend / 钱包划转）。
7. 生成系统回放余额（第 1 章纯函数回放），与当前余额快照对账。

### 2.5 增量同步与时间切片

- **游标**：`myTrades` 用 `fromId`；`allOrders` 用 `orderId` 或时间窗口；资金流接口用时间窗口。游标落 `sync_cursor`。
- **时间切片**：所有"窗口上限"接口（24h / 7d / 30d / 90d / 180d）按上限切片循环拉取，避免漏数据。
- 每个 `(account, endpoint, symbol)` 维护独立游标。

### 2.6 幂等与去重

- **幂等键**（第 1 章）：成交 = `account + symbol + trade_id`；资金流 = `account + event_type + external_id`。
- 入账用 upsert / 冲突即跳过，使重复拉取、乱序到达无副作用（呼应 §1.6 全量回放）。
- **只入账终态成功**记录（`status = SUCCESS / CONFIRMED`）；`pending` 不入账，后续轮询转终态再入。

### 2.7 限频管理

- 区分 **IP weight** 与 **UID weight**；各接口 weight 见 §2.2 来源。
- 调度器按 weight 预算节流；多子账户按预算串行 / 受控并发。
- **退避**：`429` / `418` / `-1003`（限频）→ 指数退避并尊重 `Retry-After`；`-1021`（时钟漂移）→ 用 `exchangeInfo.serverTime` 校准后重试。

### 2.8 失败重试与可观测

- 失败按指数退避重试，超上限标记失败、不阻塞其它任务。
- 每个同步任务落 `last_success_at` / `last_error`（`sync_cursor`）。
- 同步状态供账本页只读展示；失败 / 长时间未成功 → 推送告警（不含敏感信息）。

### 2.9 调度与触发模型

Phase 1 纯 REST（backfill + 增量），无 WebSocket。账户事实只在用户操作后才变，故**不高频轮询**，改用「手工即时 + 按需触发 + 低频兜底」组合：

| 触发 | 作用 | 频率 |
| --- | --- | --- |
| **手工「立即同步」按钮** | 主力、最及时：在 Binance 下单 / 充提后点一下即拉取 | 用户触发 |
| 打开账本页按需触发（on-view） | 让手工在关心数据的时刻几乎自动发生 | 进页面时 |
| 低频定时同步（安全网） | 兜住非主动交易的变动（充值 / 分红 / dust）+ 对账心跳 | 每小时 ~ 每几小时 |
| 慢车道 | 罕见且不时敏者（Dividend 180d、Dust 近 100 条）单独低频 | 每日一次 |
| 新鲜度指示 | 账本页常显「上次成功同步：X 分钟前」，过时可见即可控 | 持续 |

- 即便定时设到 1 小时，仍有窗口期数据未刷新；**手工按钮是保证及时性的主要机制，定时只作兜底。**
- 手工按钮需防抖（运行中禁用），并受限频预算约束。
- WebSocket（User Data Stream）推迟 Phase 1.5；即便接入，REST backfill 仍不可替代（WebSocket 不能重建历史），手工按钮可保留做强制刷新。

### 2.10 与对账的衔接

每轮同步后触发对账（第 5 章，占位）：纯函数回放出的 computed 余额 vs `account_balance_snapshot`。不平时按"漏 Convert / Dust / Dividend / 钱包划转 / 未知 symbol"排查——守恒不变式（§1.5）是入口。

---

## 第 3 章 API key 绑定功能

### 3.1 定位

绑定功能是**接入 / 设置流程**（非日常账本页操作），维护核心三元组并产出同步管道所需的**路由表 + 凭证健康状态**：

```
策略 strategy ↔ 子账户 exchange_account(subUserId/email) ↔ 只读 key api_credential
```

外加：**master 账户 ↔ master key**（不绑策略，用于 master 级接口）。

### 3.2 绑定流程（onboarding）

1. **子账户发现**：master key 调 `GET /sapi/v1/sub-account/list` → 落 `exchange_account`（含 `is_freeze`）。
2. **选策略绑子账户**（1:1）。
3. **录入只读 key/secret** → secret 写入 `.env`，DB 仅存 `key_ref`（环境变量前缀）。
4. **安全体检**：用该 key 调 `GET /sapi/v1/account/apiRestrictions`，过闸（§3.3）才算成功。
5. 通过 → 绑定 `active`，进入路由表；不通过 → **阻止保存 + 高危告警**。
6. master key 同样走体检（只读；如需读主子划转/充值则保留对应读取权限）。

每步结果写 `account_binding_audit`（只追加）。

### 3.3 安全闸门（绑定时卡死 + 定期复检）

| 检查项 | 子账户 key 要求 | 不满足 |
| --- | --- | --- |
| `enable_reading` | true | BLOCK |
| `enable_withdrawals` | false | **BLOCK** |
| `enable_spot_and_margin_trading` | false | **BLOCK** |
| `enable_internal_transfer` / `permits_universal_transfer` | false | BLOCK |
| `ip_restrict` | true | WARN（强烈建议开） |

- **复检节奏**：每次同步任务启动前 + 定期（如每日）跑一次体检，结果落 `api_key_health_check`。
- 复检发现**权限超标 / key 失效** → 该 `api_credential` 置 `blocked`、**暂停对应策略同步**、推送告警（不含密钥与敏感信息）。

### 3.4 状态机

`exchange_account` × `api_credential` 的活跃性由两者共同决定：

| 状态 | 含义 | 进入条件 |
| --- | --- | --- |
| `discovered` | 已发现、未绑策略 | `sub-account/list` 拉到 |
| `pending_check` | 已绑策略、已录 key、待体检 | 完成 §3.2 步 2–3 |
| `active` | 可同步 | 体检过闸 |
| `blocked` | 不可同步 | key 失效 / 权限超标 |
| `frozen` | 交易所冻结 | `is_freeze=true` |
| `unbound` | 已解绑 | 人工解绑 |

> `frozen` 子账户不得作为活跃策略账户。`blocked` → 换 key 体检通过后回 `active`。

### 3.5 关键操作（均写 `account_binding_audit`）

| 操作 | 说明 |
| --- | --- |
| `BIND` | 策略 + 子账户 + key 首次绑定 |
| `ROTATE_KEY` | 换 key：**新 key 先体检通过再切换**，旧 `key_ref` 作废；不动策略绑定 |
| `REBIND_STRATEGY` | 策略改绑到新子账户（迁移）；历史成交仍按原归属，保留审计 |
| `UNBIND` | 解绑，停止该账户同步 |

### 3.6 约束 / 不变式

- 1 子账户 ↔ 至多 1 个 `active` 策略；1 实盘策略 ↔ 恰好 1 子账户。
- 可同步的子账户必须有 ≥1 把 `active` 只读 key。
- master 账户单独一把 key，不绑策略。

### 3.7 产出：同步路由表

绑定完成后，同步管道据此决定「用哪把 key 调哪些接口」：

| 账户角色 | 用的 key | 负责的接口 |
| --- | --- | --- |
| 子账户 | 该子账户只读 key | `GET /api/v3/account`、`GET /api/v3/myTrades`、`GET /api/v3/allOrders` |
| master | master key | `sub-account/list`、`sub-account/assets`、`sub-account/universalTransfer`、`capital/deposit/subHisrec`、`capital/deposit/hisrec`、`capital/withdraw/history` |

> 依据 ADR-0003 实测：master key **读不到**子账户 Spot 成交，故子账户级接口必须走各自的 key。

### 3.8 密钥与脱敏（呼应 ADR-0003 / 立项书 §18）

- secret 存 `.env`（gitignored，`chmod 600`）；DB / git 仅存 `key_ref`；入库一份 `.env.example`（仅变量名）。
- 经 `key_ref` 抽象，日后换 Keychain / 1Password 不动绑定逻辑。
- 日志、推送、报错**不得打印** key / secret / 充提地址全文。

### 3.8.1 Key 分层与环境变量约定

账本层是 Binance 账户 key 的唯一归口。信号层行情取数不需要 key；策略层只引用账本产出的绑定状态与账户事实，不读取任何 key / secret。

| Key 类型 | `credential_role` | 归属 | 负责接口 | 环境变量前缀示例 |
| --- | --- | --- | --- | --- |
| 行情接口 | — | 信号层 public data | `api/v3/klines`、`fapi/v1/fundingRate`、`futures/data/*` | 不配置 key |
| Master 只读 key | `MASTER_READ_ONLY` | master 账户 | `sub-account/list`、`sub-account/assets`、主子划转 / 充提历史 | `BINANCE_MASTER` |
| 策略子账户只读 key | `STRATEGY_SUB_READ_ONLY` | 每个实盘策略绑定的 Binance 子账户 | `api/v3/account`、`api/v3/myTrades`、`api/v3/allOrders` | `BINANCE_STRATEGY_CORE_ALLOCATION_LT` |

`.env` 变量命名：

```env
BINANCE_API_BASE_URL=https://api.binance.com
BINANCE_FAPI_BASE_URL=https://fapi.binance.com
BINANCE_RECV_WINDOW_MS=5000

BINANCE_MASTER_API_KEY=...
BINANCE_MASTER_API_SECRET=...

BINANCE_STRATEGY_CORE_ALLOCATION_LT_API_KEY=...
BINANCE_STRATEGY_CORE_ALLOCATION_LT_API_SECRET=...
```

规则：

- `key_ref` 只保存环境变量前缀，如 `BINANCE_STRATEGY_CORE_ALLOCATION_LT`；运行时由同步器拼出 `${key_ref}_API_KEY` 与 `${key_ref}_API_SECRET`。
- `.env.example` 只入库变量名与空值 / 示例 base URL，绝不含真实 key / secret。
- 所有 `USER_DATA` / signed 请求由账本同步器统一加 `X-MBX-APIKEY`、`timestamp`、`recvWindow` 与 `signature`；业务日志只记录 `key_ref`、endpoint、risk level，不记录 header / query 原文。
- 每轮账户同步启动前，对 master key 和所有策略子账户 key 先跑 `GET /sapi/v1/account/apiRestrictions`；出现 `BLOCK` 则暂停对应账户同步。

### 3.9 Phase 1 交付形态

绑定与密钥管理 Phase 1 **不做专门 UI**，按下表分工：

| 部分 | Phase 1 做法 |
| --- | --- |
| 密钥 secret | 手动写入 `.env`，UI / 浏览器永不接触（降低泄露面） |
| 绑定关系（子账户 ↔ 策略） | 配置文件 + `setup` / `verify` 命令（发现子账户、跑安全体检） |
| 状态可见性（必须） | 账本页**只读展示**：策略 ↔ 子账户绑定、上次体检结果、BLOCK / WARN；Phase 1 站内告警 |

- 呼应总 PRD §2.6「写操作面极小」：绑定是低频设置操作（Phase 1 仅 1 策略），不进日常写操作面。
- **绑定 UI 推迟到 Phase 2**：多策略、频繁绑定 / 换 key / 迁移时，再做「只管映射、不碰 secret」的轻量 UI。

---

## 第 4 章 待归属队列与人工兜底

### 4.1 定位

因物理子账户（1 子账户 = 1 策略），交易所内正常成交**几乎都自动归属**（第 1 章）。待归属队列是一层**薄兜底**，只接住自动归属失败或不适用的少数情形。**Phase 1 单策略下它基本休眠**，但必须存在——保证「每一单位都有归属」（守恒不变式右边，§1.5）。

### 4.2 自动归属规则（默认路径，不入队）

| 事件 | 自动归属 |
| --- | --- |
| 交易所内成交 | `strategy` = 子账户绑定策略；`strategy_version` = 成交时点版本 |
| 子账户内资金流（充值 / 分红 / dust 等） | 该子账户绑定策略 |
| master 账户资金流（充值 / 划出） | 「主账户未分配池」（合法静止态，非待归属） |

仅当上述**无法判定**时才进待归属队列。

### 4.3 进入待归属队列的情形

| 情形 | 来源 |
| --- | --- |
| 外部 / 系统外交易 | 第 6 章手工录入，录入后待归属到策略 |
| 子账户绑定前的历史成交 | 第 2 章 backfill 拉到尚未绑定策略的子账户 → 绑定后可批量归属 |
| 不满足自动归属规则 | 如成交资产不在该策略资产池范围、明显异常 → 标记 review |
| 对账差异下放 | 第 5 章 `NEEDS_CLASSIFICATION` / 疑似多记 → 人工判定来源 |

> 「主账户未分配」是合法状态，**单独展示，不混入待归属队列**。

### 4.4 处理（人工兜底，只追加）

- 队列展示：事件、账户、资产、数量、时间、疑似来源、建议归属。
- 操作：归属到某策略（+ 版本）/ 标为外部 / 标为未分配 / 冲正（若系误记）。
- **归属动作写一条 `attribution_record`（只追加）**，不改原成交 / 事件记录；on-exchange 成交的归属由账户绑定派生，外部 / 待归属项的归属由 `attribution_record` 给出。
- **批量归属**：如「某子账户绑定策略后，把其名下全部待归属成交一次归属」。
- **重新归属**：追加新 `attribution_record`，最新生效、旧记录保留可追溯。

### 4.5 不变式 / 约束

- 每个需归属事件最终要么归到某策略（+ 版本），要么明确归到「未分配池」或「外部」，**不允许悬空**。
- 归属只追加；禁止删除 / 静默改写（呼应只追加哲学）。
- 待归属项数量是健康指标：长期堆积 → 告警。

### 4.6 衔接

- 上游：第 5 章对账差异、第 6 章外部录入、第 2 章 backfill（绑定前）。
- 前端：账本页「待归属交易队列」（第 8 章），是账本页两类写操作之一（归属交易）。
- Phase 1 单策略预期队列接近空；该机制主要为 Phase 2 多策略与外部钱包准备。

---

## 第 5 章 对账（验收标准：账对不对）

### 5.1 定位

对账是账本层验收标准「账对不对」的落地：把**我们从事件流回放算出的余额（computed）**，与**交易所现报余额（reported）**逐账户逐资产比对。守恒不变式（§1.5）是其数学基础。

```
computed  = compute(events, now).balance[account][asset]   ← 第 1 章纯函数
reported  = 最新 account_balance_snapshot[account][asset]   ← 第 2 章拉取
```

### 5.2 对账口径

- **维度**：每个 `exchange_account` × 每个 `asset`。因 1 策略 = 1 子账户，对账天然按子账户独立进行；主账户、外部钱包各自对账。
- **余额口径**：`reported 总量 = free + locked`（挂单锁定仍属持有）；`freeze` / `withdrawing` 作为排查信号单列，是否计入以 API 语义实测为准。
- **精度阈值**：按资产精度（`exchangeInfo.baseAssetPrecision`）设容差，浮点 / 手续费尾差不判为差异。

### 5.3 对账结果状态

对每个 `(account, asset)`：

| 状态 | 判定 | 典型成因 |
| --- | --- | --- |
| `MATCHED` | `|computed − reported| ≤ 阈值` | 账平 |
| `MISSING_EVENT` | reported > computed | 交易所有、我们缺事件：漏同步成交 / 充值 / 分红 |
| `EXTERNAL_BALANCE_MISMATCH` | computed > reported | 我们记了、交易所没有：多记 / 归属错 / 资产已挪到非 Spot 钱包或外部 |
| `NEEDS_CLASSIFICATION` | 差异可归因于未纳入的资产变动 | Convert / Dust / Dividend / Funding / Earn 钱包划转未分类 |

并做一次**全局守恒校验**：`Σ各账户 computed = Σ各策略持仓（含现金腿）+ 主账户未分配`，作为总闸。

### 5.4 `reconciliation_result` 字段

| 字段 | 说明 |
| --- | --- |
| `id` | 本地 ID |
| `account_id` / `asset` | 对账维度 |
| `computed_qty` / `reported_qty` / `diff` | 算出值 / 现报值 / 差异 |
| `status` | §5.3 四态 |
| `threshold` | 当次容差 |
| `snapshot_ref` | 引用的 `account_balance_snapshot` |
| `checked_at` | 对账时间 |
| `note` | 排查备注 |

### 5.5 触发与频率

- 每轮同步后自动触发（§2.10）；手工同步后触发；亦可单独手工「对账」。
- 结果只追加进 `reconciliation_result`，形成可复盘的对账历史。

### 5.6 差异处理流程（人工兜底，只追加）

1. `MATCHED`：无操作。
2. 非 `MATCHED`：账本页**对账面板高亮** + 推送告警（不含敏感信息）。
3. 排查路径（自动 → 人工）：
   - **先扩同步**：补拉可能漏的接口（Convert / Dust / Dividend / 钱包划转 / 未知 symbol）→ 重算；
   - 仍不平 → 进人工判断：是外部钱包 / 系统外交易（→ 第 6 章手工录入）、归属错误（→ 第 4 章待归属）、还是需冲正。
4. **任何更正只走「只追加」**（补事件 / 冲正），不改历史。

> 红线：**不允许「手工改余额对平」**。只能补事实，让回放自然对上——呼应只追加哲学。

### 5.7 衔接

- 输入：第 1 章 computed + 第 2 章 `account_balance_snapshot`。
- 输出差异 → 第 4 章待归属 / 第 6 章外部录入。
- 前端对账面板详见第 8 章。
- **验收**：所有 `(account, asset)` 长期收敛到 `MATCHED`，或每个差异都有明确归因。

---

## 第 6 章 外部交易手工录入

### 6.1 定位

系统外（外部钱包 / 链上 / 其它交易场所）发生、且 Binance API 拉不到、但**影响持仓**的交易事实，由人工录入，使组合与对账完整、外部持仓也能归属策略并参与复盘。低频、人工、最小字段。

### 6.2 范围（Phase 1）

- **做**：外部钱包链上兑换（swap）、其它交易所成交、OTC 等的手工录入。外部钱包以 `exchange_account(account_role=EXTERNAL_WALLET)` 存在。
- **不做**：自动链上抓取（Phase 2+）、税务处理。

### 6.3 最小字段集与校验

字段见 §1.4.8 `external_trade`。

- **必填**：`wallet_account`、`side`、`base_asset` / `quote_asset`、`base_qty`、`price` 或 `quote_qty`、`occurred_at`。
- **可选**：`fee_amount/asset`、`note`（执行理由）、`tx_id`（链上）。
- **校验**：数量 / 价格 > 0；`occurred_at` 不晚于当前；资产在资产字典内。

### 6.4 录入流程

1. 选择 / 新建外部钱包账户。
2. 填最小字段。
3. 提交 → 写 `external_trade`（只追加）。
4. 归属：录入时可直接指定策略；否则进**待归属队列**（第 4 章），归属时写 `attribution_record`。
5. 自动参与回放（§1.6 纯函数）：lots / 持仓 / 成本随之纳入。

### 6.5 与对账的关系

- 外部钱包无 API，**不强制自动对账**；以录入事件为准，余额 = 回放结果。
- 可选：人工录入外部钱包当前余额做核对。
- 外部持仓录入是第 5 章 `EXTERNAL_BALANCE_MISMATCH` 的一类正当来源（资产其实在外部）。

### 6.6 更正与写边界

- 录错 → **冲正（reversal）+ 重录**，不直接改。
- 属账本页两类写操作之一（录入外部交易）；前端在账本页（第 8 章）；`entered_by` 记录操作者。

---

## 第 7 章 备份与保留策略

### 7.1 定位

账本**事件流 + 决策时点快照 = 不可丢失数据**（系统的事实根基，丢失则无法复盘、无法重建持仓）。派生数据可从事件流重建，不是备份重点。呼应立项书 §18.3。

### 7.2 备份对象（按重要性）

| 对象 | 重要性 | 能否重建 |
| --- | --- | --- |
| 事件流三表 + `raw_payload` | 最高 | 不可重建（源真相） |
| `decision_snapshot` 内容 | 最高 | 不可重建 |
| `attribution_record` / `account_binding_audit` / 外部录入 | 高 | 不可重建（人工产出） |
| 配置（绑定关系、symbol 字典） | 中 | 部分可重拉 |
| 派生（`lot` / `position` / `balance` / `reconciliation_result`） | 低 | 可回放重建，无需重点备份 |

### 7.3 备份策略（Phase 1 务实）

- **频率**：每次成功同步后 / 每日增量；定期全量。
- **多副本**：本地 + 至少一份**离机**（异地 / 对象存储 / 外部盘）。
- **防篡改**：源数据只追加，备份亦应防覆盖（版本化 / WORM 可选）。
- **恢复演练**：定期从备份重建并回放对平，验证备份可用。
- 数据量小、成本低（快照体量见 §7.6）。

### 7.4 密钥不进常规备份

- `.env` / secret **不随数据备份**；单独安全保管（密码管理器 / 离线）。备份内**不得含明文密钥**——即使备份泄露也无可用密钥。

### 7.5 保留策略

- **事件流 + 快照**：长期保留、不删（复盘 / 回测需完整历史）。
- **`raw_payload`**：保留（审计 / 排查），体量评估后定窗口。
- **派生数据**：可随时回放重建，无需长期保留。

### 7.6 快照体量与成本（开放问题）

`decision_snapshot` 内容体量取决于信号层输入维度的数量与频率，需信号层定稿后估算（呼应总 PRD §5.6）。本章保留占位，量化后回填备份 / 存储成本。

### 7.7 恢复模型

恢复 = 取回事件流 + 快照 → 纯函数回放（§1.6）重建全部派生。故备份只需守住源数据与快照，即可还原整个账本层。

---

## 第 8 章 账本页（前端）

> 前端**直接参照** `design/数字资产投资操作系统_视觉说明.html`（token / 组件 / 系统态词表），决策依据见 ADR-0002。本章只定**页面功能与模块优先级**，不另起一套视觉。

### 8.1 定位与语气

- 对应事实层，落实总 PRD §2.5。语气取视觉契约「Page Language · 账本页」：**操作清晰，同步状态、对账差异、待归属队列优先；琥珀 / 红色只用于问题。**
- **写操作面极小**：全页仅两类写操作——**归属交易、录入外部交易**（对齐第 4 / 6 章；四类全系统写操作见总 PRD §2.6）。其余一律只读。

### 8.2 模块优先级（问题优先）

1. 同步与新鲜度条（顶部）
2. 对账面板
3. 待归属交易队列
4. 流水查询（成交 / 充提划转）
5. 外部交易录入入口
6. 绑定与凭证健康（只读）

### 8.3 同步与新鲜度

- 各管道**上次成功同步时间**（新鲜度指示，§2.9）。系统态用契约 `pill`：`已同步 ok` / `数据陈旧 stale` / `同步失败 fail`。**同步失败为账本页最优先级**：红色 + 失败原因 + 重试入口。
- **手工「立即同步」按钮**（§2.9）：`btn primary`；运行中禁用（防抖）；加载用骨架屏（`load`）。
- 五态必须可表达，**不能只有乐观态**（呼应「记录中断是最常见死法」）。

### 8.4 对账面板

- 系统回放余额（computed）vs Binance 实际（reported）**逐账户逐资产**比对，差异高亮。
- 四态（§5.3）映射到契约徽章：`MATCHED` → `badge good`「已对平」；`MISSING_EVENT` / `EXTERNAL_BALANCE_MISMATCH` → `badge risk`「对账差异 +0.0021 BTC」；`NEEDS_CLASSIFICATION` → `badge todo`。
- 表格：账户、资产、computed、reported、`diff`（右对齐 tabular，差异带 +/− 不只靠色）、状态、上次对账时间。展示全局守恒校验结果。
- 差异可钻取「可能来源」（漏 Convert / Dust / Dividend / 钱包划转 / 未知 symbol）。
- **全只读**：不提供「手工改余额对平」（§5.6 红线），只能去补事实 / 冲正。

### 8.5 待归属交易队列

- 列出待归属项（§4.3）：事件、账户、资产、数量、时间、疑似来源、建议归属。数量用 `badge todo`；空队列用 `empty`「暂无」。
- 写操作**归属交易**：归属到策略（+ 版本）/ 标为外部 / 标为未分配 / 冲正；支持**批量归属**。每次写 `attribution_record`（只追加，§4.4）。

### 8.6 流水查询（只读）

- 成交流水（`exchange_trade_fill`）、充提划转流水（`capital_flow_event`），按账户 / 资产 / 时间 / 类型筛选。
- 表格右对齐 tabular 数字、配 ▲▼ 或 +/−；术语英文、正文中文。
- 成交行可展示绑定的 `snapshot_id`（点击跳市场页快照查看器·冻结态）与 strategy / version。

### 8.7 外部交易录入

- 写操作**录入外部交易**：最小字段表单（§6.3）；提交 → `external_trade` → 进待归属或直接指定策略。
- 录错 → 冲正 + 重录（不直接改，§6.6）。

### 8.8 绑定与凭证健康（只读）

- 展示策略 ↔ 子账户绑定、上次体检结果（`api_key_health_check`）、`BLOCK` / `WARN`（§3.9）；Phase 1 做站内告警，外部推送延后。
- Phase 1 **不在 UI 做绑定写操作**；**secret 永不显示 / 永不录入网页**。

### 8.9 视觉与交互规则（沿用契约）

- token 全取自 `:root`；复用 `panel` / `table` / `badge` / `btn` / `pill` / `tab` 组件，不新造。
- 涨跌 / 差异**不只靠颜色**（▲▼ / +−）；右对齐 tabular 数字；细边框分层不靠大阴影。
- 账户敏感信息（余额 / 地址）只在页面内；**站内动态 / 未来推送均绝不含**（与视觉契约 Push Card 一致）。
- 桌面优先；移动端只保留关键状态查看（同步状态 / 对账告警 / 待归属计数）。

### 8.10 衔接

- 数据来自第 1（模型）/ 2（同步）/ 4（待归属）/ 5（对账）/ 6（外部录入）章。
- 跳转：成交 `snapshot_id` → 市场页快照查看器；归属 → 策略页。
- 仅两类写操作，符合视觉契约「操作面克制」。

---

## 第 9 章 开放问题与待办

- **快照体量估算**（§7.6）：待信号层定稿后回填备份 / 存储成本。
- **API 实测确认**：ADR-0003 的 A1（子账户数量上限）、A2（主账户不交易约束）、A4（子账户间划转即时免费）。
- **技术栈选型后**：回填各实体字段类型、补 AGENTS.md §4 验证门命令。
- **真实高保真整页 mockup**：按 ADR-0002 延后到实现阶段，不在本 PRD。
