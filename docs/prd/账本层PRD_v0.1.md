# 账本层 PRD（事实层 · 账户事实库）v0.1

> 文档定位：三份子 PRD 之一，展开事实层中「账户事实库」子域 + 同步基础设施 + 决策时点快照的存储机制。
>
> 上游文档：《数字资产投资操作系统_总PRD_v0.1》§3.1；《数字资产投资项目立项计划书_v0.2》§5。
> 决策依据：`docs/decisions/0003-ledger-account-model-and-sync-architecture.md`（账户模型与同步架构）。
> 数据源依据：`docs/research/binance-account-api-research.md`（Binance 账户/同步 API 调研）。
>
> 本版范围：第 0 章（定位与边界）、第 1 章（核心数据模型）、第 2 章（Binance 同步管道）、第 3 章（API key 绑定功能）。其余章节（待归属、对账、外部录入流程、备份、账本页）见后续版本占位（§9）。

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
7. 生成虚拟账本余额（第 1 章纯函数回放），与当前余额快照对账。

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
3. **录入只读 key/secret** → secret 写入 `.env`，DB 仅存 `key_ref`（环境变量名）。
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

### 3.9 Phase 1 交付形态

绑定与密钥管理 Phase 1 **不做专门 UI**，按下表分工：

| 部分 | Phase 1 做法 |
| --- | --- |
| 密钥 secret | 手动写入 `.env`，UI / 浏览器永不接触（降低泄露面） |
| 绑定关系（子账户 ↔ 策略） | 配置文件 + `setup` / `verify` 命令（发现子账户、跑安全体检） |
| 状态可见性（必须） | 账本页**只读展示**：策略 ↔ 子账户绑定、上次体检结果、BLOCK / WARN；失效推送告警 |

- 呼应总 PRD §2.6「写操作面极小」：绑定是低频设置操作（Phase 1 仅 1 策略），不进日常写操作面。
- **绑定 UI 推迟到 Phase 2**：多策略、频繁绑定 / 换 key / 迁移时，再做「只管映射、不碰 secret」的轻量 UI。

---

## 第 9 章 后续版本占位

以下章节待后续版本展开（不阻塞已写章节评审）：

- 第 4 章 待归属队列与人工兜底
- 第 5 章 对账逻辑（状态机，见调研 §6.3）
- 第 6 章 外部交易手工录入流程
- 第 7 章 备份与保留策略
- 第 8 章 账本页功能细化（前端，沿用视觉契约）
