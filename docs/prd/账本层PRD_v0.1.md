# 账本层 PRD（事实层 · 账户事实库）v0.1

> 文档定位：三份子 PRD 之一，展开事实层中「账户事实库」子域 + 同步基础设施 + 决策时点快照的存储机制。
>
> 上游文档：《数字资产投资操作系统_总PRD_v0.1》§3.1；《数字资产投资项目立项计划书_v0.2》§5。
> 决策依据：`docs/decisions/0003-ledger-account-model-and-sync-architecture.md`（账户模型与同步架构）。
> 数据源依据：`docs/research/binance-account-api-research.md`（Binance 账户/同步 API 调研）。
>
> 本版范围：第 0 章（定位与边界）、第 1 章（核心数据模型）。其余章节（同步管道、待归属、对账、外部录入流程、备份、账本页）见后续版本占位（§9）。

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
2. **判断层零依赖**：账本层数据**只服务决策层**；判断层（信号层）对账户事实库零依赖——市场状态判定不得受个人持仓影响。
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

**做**：Binance 只读同步（成交/充提/划转及衍生资产变动）、虚拟账本 v0（基于物理子账户）、快照存储 v0、API key 绑定与安全体检、对账、外部交易手工录入。

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
| `reversal`（事件标记） | 冲正：任一源数据事件的反向纠错 | 只追加 |
| `decision_snapshot` | 决策时点快照容器 | 只追加 |
| `lot` | 持仓批次（成本基础载体） | 派生（回放算出） |
| `position`（视图） | 策略 × 资产 当前持仓 | 纯派生 |
| `balance`（视图） | 账户 × 资产 当前余额 | 纯派生 |
| `account_balance_snapshot` | 定期从交易所拉取的余额（对账目标） | 只追加 |
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
| `key_label` | 人类可读标签 |
| `key_ref` | **指向 `.env` 的环境变量名**（如 `BINANCE_SUB1_KEY`）；不存明文 |
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
| `snapshot_id` ★ | 决策时点快照 | 系统绑定 |
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

- `position`（策略 × 资产）：`qty = Σ lot.qty_remaining`、`avg_cost`、市值、未实现盈亏。
- `balance`（账户 × 资产）：由事件流增量投影；用于对账。

**1.4.12 `sync_cursor` / `account_balance_snapshot`**：字段见 API 调研 §5.7 / §5.3。

### 1.5 守恒不变式

对任意资产：

```
Σ(各账户 computed balance) = Σ(各策略各 lot 剩余) + 主账户未分配
```

- 左边对比 `account_balance_snapshot`（交易所实际）= **对账**；
- 右边要求每一单位都有归属，无法归属则挂「主账户未分配」= **归属完整性**。
- 两边不平 → 有事件漏记（典型：Convert/Dust/Dividend/钱包划转未同步）或归属错误。

### 1.6 派生原则与持仓计算（Phase 1 决策）

账户余额、策略持仓、lots、成本、盈亏**全部由事件流全量回放（replay）现算**，源头永远是事件流，不持久化为派生表。

- 计算收敛为一个**纯函数** `compute(events, asOf) → {balance, lots, position}`：按 `occurred_at` 排序（`trade_id` / `event_id` 兜底），fold 出截至 `asOf` 的账面。任意历史时点账面 = 把 `asOf` 设为该时刻。
- 摄入需**幂等去重**（按各表幂等键），使纯函数对乱序到达、重复拉取天然稳定——这是全量回放相对增量投影的关键正确性优势。
- **Phase 1 不做投影表、不做内存缓存、不做状态检查点。** 理由：本项目量级（个人现货中长期，年成交数百~千条，多年累计低万级事件）下全量回放为毫秒级，且对账（§1.5）本就要全量聚合；增量投影叠加 FIFO 对乱序敏感，复杂度与正确性风险不划算。
- **再评估触发条件**：事件量级显著上升（如 10 万级且热路径频繁重算），或出现实时高频读取时，再考虑加内存记忆化或物化投影；届时纯函数已在，后加为低风险缓存。

---

## 第 9 章 后续版本占位

以下章节待后续版本展开（不阻塞第 0–1 章评审）：

- 第 2 章 Binance 同步管道（backfill / 增量 / 限频 / 幂等 / 时间切片，见调研 §6）
- 第 3 章 API key 绑定功能（流程 / 状态机 / 安全闸门 / 复检）
- 第 4 章 待归属队列与人工兜底
- 第 5 章 对账逻辑（状态机，见调研 §6.3）
- 第 6 章 外部交易手工录入流程
- 第 7 章 备份与保留策略
- 第 8 章 账本页功能细化（前端，沿用视觉契约）
