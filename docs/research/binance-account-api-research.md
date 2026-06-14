# Binance 账户与交易同步 API 调研

> 日期：2026-06-14  
> 范围：Binance Global 官方文档；现货 Spot；Phase 1 只读同步；一阶段产品假设为「一个实盘策略绑定一个 Binance 子账户」。  
> 非范围：Binance.US、合约、杠杆、期权、自动下单、提现。  
> 重要原则：本文只整理官方文档已说明的能力；带有「项目推断」字样的内容，是基于官方接口边界做出的实现建议，不是 Binance 原文。

## 1. 账户结构结论

### 1.1 Master Account 与 Sub-account

官方 FAQ 对子账户的定位是：子账户允许用户通过多个账户交易，可用于职责分离、交易管理、测试和执行不同交易策略、以及将资产分散到不同账户做风险管理。FAQ 同时说明，完成身份认证和 2FA 的普通用户可使用子账户功能，普通用户限制为 5 个子账户；VIP / 机构账户可获得更高额度。  
来源：[Binance Sub-Account Functions and FAQ](https://www.binance.com/en/support/faq/detail/360020632811)

对本项目的账户结构建议：

- `MASTER`：主账户，只作为资金中转、API 管理、子账户查询入口；不承载策略交易。
- `SUB_ACCOUNT`：策略实盘账户；Phase 1 一个策略绑定一个子账户。
- Phase 1 实盘策略上限：按普通用户额度，最多 5 个绑定 Binance 子账户的实盘策略。
- 观察策略、纸面策略、研究策略不占 Binance 子账户名额。

### 1.2 子账户 API key

官方 FAQ 说明每个子账户最多可创建 30 个 API key，并可通过子账户使用 API 进行下单、查询、持仓等操作。虚拟邮箱子账户不能登录，只能由主账户通过 API 操作，并需要为子账户创建 API key。  
来源：[Binance Sub-Account Functions and FAQ](https://www.binance.com/en/support/faq/detail/360020632811)

项目推断：

- 主账户 API key 用于：子账户列表、子账户资产、主子账户划转、子账户充值记录等 master-level 子账户接口。
- 每个策略子账户应配置独立的只读 API key，用于调用 Spot `GET /api/v3/account`、`GET /api/v3/myTrades`、`GET /api/v3/allOrders` 等“当前账户”私有接口。
- 不应假设 master API key 可以直接读取所有子账户的 Spot 成交明细；官方子账户文档列出了资产/划转/充值等 master-level 查询接口，但 Spot account endpoint 本身是账户级接口。

### 1.3 API key 安全边界

Binance Spot 文档将私有接口区分为 `USER_DATA`、`TRADE`、`USER_STREAM` 等安全类型。`USER_DATA` 用于账户信息、订单状态、交易历史；`TRADE` 才用于下单/撤单。文档说明，默认 API key 不能交易，需要在 API Management 单独开启交易权限。  
来源：[Spot Request Security](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/request-security)

Phase 1 安全要求：

- 主账户 key：允许 `USER_DATA` / reading；如需要主子账户资金划转，才考虑 internal transfer / universal transfer 权限，并应单独评审。
- 子账户 key：只读 `USER_DATA`；禁止 `TRADE`、禁止提现。
- 所有 key 必须 IP 限制；密钥不入库。
- 调用启动时先检查 API key 权限，发现交易/提现权限打开应告警。

## 2. Phase 1 必须使用的 API

### 2.1 获取 API key 权限

官方来源：[Get API Key Permission](https://developers.binance.com/docs/wallet/account/api-key-permission)

调用细节：

- Method / Path：`GET /sapi/v1/account/apiRestrictions`
- Security：`USER_DATA`
- Weight：`1` IP
- 必填参数：`timestamp`
- 可选参数：`recvWindow`

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `ipRestrict` | 是否启用 IP 限制 | 安全检查；未开启时告警 |
| `createTime` | API key 创建时间 | 审计展示 |
| `enableReading` | 是否允许读取 | 必须为 `true` |
| `enableWithdrawals` | 是否允许 API 提现 | Phase 1 必须为 `false` |
| `enableInternalTransfer` | 是否允许主子账户即时划转 | 只有资金划转自动化时才考虑 |
| `permitsUniversalTransfer` | 是否允许 universal transfer | Phase 1 默认不需要，若开启需审计 |
| `enableSpotAndMarginTrading` | 是否允许现货/杠杆交易 | Phase 1 必须为 `false` |

PRD 要点：

- 这是同步任务的启动前置检查。
- 如果子账户 API key 开启交易或提现权限，系统应阻止保存或至少标记高危。
- 此接口只告诉我们“当前 API key 的权限”，不是账户资产数据源。

### 2.2 查询子账户列表

官方来源：[Query Sub-account List](https://developers.binance.com/docs/sub_account/account-management/Query-Sub-account-List)

调用细节：

- Method / Path：`GET /sapi/v1/sub-account/list`
- Security：`USER_DATA`
- 调用账户：Master account
- Weight：`1` IP
- 必填参数：`timestamp`
- 可选参数：`email`、`isFreeze`、`page`、`limit`、`recvWindow`
- `limit`：默认 `1`，最大 `200`

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `subAccounts[]` | 子账户数组 | 账户发现 |
| `subUserId` | 子账户用户 ID | 本地 `exchange_account.external_account_id` |
| `email` | 子账户邮箱 / 虚拟邮箱 | 人可识别账户名，绑定策略 |
| `remark` | 备注 | 可作为策略名称辅助识别 |
| `isFreeze` | 是否冻结 | 冻结账户不可作为活跃策略账户 |
| `createTime` | 创建时间 | 审计 |
| `isManagedSubAccount` | 是否 managed sub-account | Phase 1 记录但不展开 |
| `isAssetManagementSubAccount` | 是否 asset management sub-account | Phase 1 记录但不展开 |

PRD 要点：

- 本接口建立本地 `exchange_account` 表。
- 策略绑定应以 `subUserId` 或 `email` 做外部账户标识。
- `isFreeze=true` 时，策略账户应进入异常态。

### 2.3 查询子账户资产余额

官方来源：[Query Sub-account Assets V3](https://developers.binance.com/docs/sub_account/asset-management/Query-Sub-account-Assets-V3)

调用细节：

- Method / Path：`GET /sapi/v3/sub-account/assets`
- Security：`USER_DATA`
- 调用账户：Master account
- Weight：`60` UID
- 必填参数：`email`、`timestamp`
- 可选参数：`recvWindow`

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `balances[]` | 子账户资产列表 | 子账户当前余额快照 |
| `asset` | 币种，如 `BTC`、`ETH`、`USDT` | 资产维度 |
| `free` | 可用余额 | 当前持仓 / 可用余额 |
| `locked` | 锁定余额 | 挂单等占用 |
| `freeze` | 冻结数量 | 异常或冻结资产 |
| `withdrawing` | 提现中数量 | 对账排查 |

PRD 要点：

- 这是每个策略子账户的当前外部余额快照来源。
- 只用于对账和展示，不用于重建历史。
- 与本地虚拟账本汇总余额对比后生成 `reconciliation_result`。

### 2.4 查询子账户 Spot 资产汇总

官方来源：[Query Sub-account Spot Assets Summary](https://developers.binance.com/docs/sub_account/asset-management/Query-Sub-account-Spot-Assets-Summary)

调用细节：

- Method / Path：`GET /sapi/v1/sub-account/spotSummary`
- Security：`USER_DATA`
- 调用账户：Master account
- Weight：`1` IP
- 必填参数：`timestamp`
- 可选参数：`email`、`page`、`size`、`recvWindow`
- `size`：默认 `10`，最大 `20`

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `totalCount` | 返回账户数量 | 分页控制 |
| `masterAccountTotalAsset` | 主账户 BTC 计价资产汇总 | 顶层资产概览 |
| `spotSubUserAssetBtcVoList[]` | 子账户汇总 | 策略账户总览 |
| `email` | 子账户邮箱 | 关联 `exchange_account` |
| `totalAsset` | 子账户 Spot 总资产 BTC 估值 | 资产概览，不作为精确账本 |

PRD 要点：

- 适合仪表盘汇总，不替代逐币余额。
- `totalAsset` 是 BTC 估值，不能直接用于策略收益计算。

### 2.5 查询子账户主子账户划转历史

官方来源：[Query Universal Transfer History for Master Account](https://developers.binance.com/docs/sub_account/asset-management/Query-Universal-Transfer-History)

调用细节：

- Method / Path：`GET /sapi/v1/sub-account/universalTransfer`
- Security：`USER_DATA`
- 调用账户：Master account
- Weight：`1` IP
- 必填参数：`timestamp`
- 可选参数：`fromEmail`、`toEmail`、`clientTranId`、`startTime`、`endTime`、`page`、`limit`、`recvWindow`
- 限制：
  - `fromEmail` 和 `toEmail` 不能同时传。
  - 未传 `fromEmail` / `toEmail` 时，默认返回 master account email 作为 `fromEmail` 的记录。
  - 查询时间段必须小于 7 天。
  - 不传时间时默认返回最近 7 天。
  - `limit` 默认 `500`，最大 `500`。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `result[]` | 划转记录 | 策略资金注入/撤出事实 |
| `tranId` | Binance 划转 ID | 幂等键 |
| `fromEmail` | 来源账户邮箱 | 资金流出账户 |
| `toEmail` | 目标账户邮箱 | 资金流入账户 |
| `asset` | 币种 | 资金流资产 |
| `amount` | 数量 | 资金流数量 |
| `createTimeStamp` | 创建时间 | 账本时间 |
| `fromAccountType` | 来源钱包类型，如 `SPOT` | 钱包维度 |
| `toAccountType` | 目标钱包类型，如 `SPOT` | 钱包维度 |
| `status` | 状态，如 `SUCCESS` | 只入账成功记录 |
| `clientTranId` | 客户端划转 ID | 若系统发起划转，可关联请求 |

PRD 要点：

- 主账户到策略子账户：记为策略资金注入。
- 策略子账户到主账户：记为策略资金撤出。
- 子账户之间划转：Phase 1 建议禁止；若发生，必须生成人工复核。
- 7 天查询窗口要求同步任务必须支持时间切片。

### 2.6 查询子账户 Spot 资产划转历史

官方来源：[Query Sub-account Spot Asset Transfer History](https://developers.binance.com/docs/sub_account/asset-management/Query-Sub-account-Spot-Asset-Transfer-History)

调用细节：

- Method / Path：`GET /sapi/v1/sub-account/sub/transfer/history`
- Security：`USER_DATA`
- 调用账户：Master account
- Weight：`1` IP
- 必填参数：`timestamp`
- 可选参数：`fromEmail`、`toEmail`、`startTime`、`endTime`、`page`、`limit`、`recvWindow`
- 限制：
  - `fromEmail` 和 `toEmail` 不能同时传。
  - 未传时默认返回 `fromEmail` 等于 master account email 的记录。
  - `limit` 默认 `500`。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `from` | 来源账户邮箱 | 资金流出账户 |
| `to` | 目标账户邮箱 | 资金流入账户 |
| `asset` | 币种 | 资金流资产 |
| `qty` | 数量 | 资金流数量 |
| `status` | 状态，如 `SUCCESS` | 只入账成功记录 |
| `tranId` | Binance 划转 ID | 幂等键 |
| `time` | 时间戳 | 账本时间 |

PRD 要点：

- 与 universal transfer 历史存在功能重叠；Phase 1 应选一个作为主来源，另一个用于补漏或验证。
- 若采用 `universalTransfer` 作为统一资金流来源，本接口可作为兼容旧记录的补充。

### 2.7 查询子账户充值历史

官方来源：[Get Sub-account Deposit History](https://developers.binance.com/docs/sub_account/asset-management/Get-Sub-account-Deposit-History)

调用细节：

- Method / Path：`GET /sapi/v1/capital/deposit/subHisrec`
- Security：`USER_DATA`
- 调用账户：Master account
- Weight：`1` IP
- 必填参数：`email`、`timestamp`
- 可选参数：`includeSource`、`coin`、`status`、`startTime`、`endTime`、`limit`、`offset`、`recvWindow`、`txId`

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `id` | Binance 充值记录 ID | 幂等键 |
| `amount` | 充值数量 | 资金流数量 |
| `coin` | 币种 | 资金流资产 |
| `network` | 链网络 | 链上排查 |
| `status` | 状态 | 只入账成功或可用记录 |
| `address` / `addressTag` | 充值地址/标签 | 审计，不建议默认展示完整 |
| `txId` | 链上交易 ID | 幂等/追踪 |
| `insertTime` | 插入时间 | 账本时间 |
| `transferType` | 转账类型 | 记录原始值 |
| `confirmTimes` | 确认数 | 状态排查 |
| `unlockConfirm` | 解锁确认数 | 状态排查 |
| `walletType` | 钱包类型 | Spot/Funding 等区分 |

PRD 要点：

- 如果允许直接向策略子账户充值，本接口必须纳入 Phase 1。
- 如果规定所有资金先进入 master 再划转子账户，本接口仍应预留，用于发现绕过规则的直接充值。

### 2.8 Spot 当前账户信息

官方来源：[Spot Account information](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/account-endpoints)

调用细节：

- Method / Path：`GET /api/v3/account`
- Security：`USER_DATA`
- 调用账户：当前 API key 所属账户。用于策略子账户时，应使用该子账户只读 API key。
- Weight：`20`
- 必填参数：`timestamp`
- 可选参数：`omitZeroBalances`、`recvWindow`
- `recvWindow` 最大 `60000`

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `makerCommission` / `takerCommission` | 手续费等级字段 | 参考，不如成交明细里的实际 commission 可靠 |
| `commissionRates` | maker/taker 等费率字符串 | 费率展示 |
| `canTrade` | 当前账户是否可交易 | 安全审计；Phase 1 key 不应交易 |
| `canWithdraw` | 当前账户是否可提现 | 安全审计 |
| `canDeposit` | 当前账户是否可充值 | 状态展示 |
| `accountType` | 如 `SPOT` | 账户类型 |
| `balances[]` | 余额数组 | 当前余额快照 |
| `balances[].asset` | 资产 | 资产维度 |
| `balances[].free` | 可用余额 | 当前持仓 |
| `balances[].locked` | 锁定余额 | 挂单占用 |
| `permissions[]` | 权限，如 `SPOT` | 账户能力 |
| `uid` | 用户 ID | 外部账户 ID 辅助字段 |

PRD 要点：

- 对子账户策略来说，这是最直接的当前余额接口。
- 与 `GET /sapi/v3/sub-account/assets` 可交叉验证。
- 余额快照不能替代事件流水；只用于展示和对账。

### 2.9 Spot 账户成交明细

官方来源：[Spot Account trade list](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/account-endpoints)

调用细节：

- Method / Path：`GET /api/v3/myTrades`
- Security：`USER_DATA`
- 调用账户：当前 API key 所属账户。用于策略子账户时，应使用该子账户只读 API key。
- Weight：
  - 不传 `orderId`：`20`
  - 传 `orderId`：`5`
- 必填参数：`symbol`
- 可选参数：`orderId`、`startTime`、`endTime`、`fromId`、`limit`、`recvWindow`、`timestamp`
- `limit` 默认 `500`，最大 `1000`
- 限制：
  - `fromId` 存在时返回 trade id 大于等于 `fromId` 的记录。
  - `startTime` 与 `endTime` 的跨度不能超过 24 小时。
  - 支持参数组合以官方文档列出的组合为准。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `symbol` | 交易对，如 `BTCUSDT` | 成交资产对 |
| `id` | trade id | symbol 内幂等键之一 |
| `orderId` | 订单 ID | 关联订单 |
| `orderListId` | OCO 等订单列表 ID | Phase 1 记录原始值 |
| `price` | 成交价格 | 成本计算 |
| `qty` | base asset 成交数量 | 持仓变化 |
| `quoteQty` | quote asset 成交数量 | 成本/现金变化 |
| `commission` | 手续费数量 | 收益计算必须入账 |
| `commissionAsset` | 手续费资产 | 持仓变化 |
| `time` | 成交时间 | 账本时间 |
| `isBuyer` | 当前账户是否买方 | 判断买/卖方向 |
| `isMaker` | 是否 maker | 手续费/执行质量分析 |
| `isBestMatch` | 是否最佳撮合 | 原样存储 |

PRD 要点：

- 这是现货策略账本的核心事实源。
- 必须按 `exchange_account_id + symbol + id` 幂等。
- Binance 要求按 `symbol` 查询；系统需要维护策略账户涉及的 symbol 清单。
- 如果不知道历史交易对，不能假设一个接口能返回全账户所有成交。

### 2.10 Spot 全部订单

官方来源：[Spot All orders](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/account-endpoints)

调用细节：

- Method / Path：`GET /api/v3/allOrders`
- Security：`USER_DATA`
- 调用账户：当前 API key 所属账户。用于策略子账户时，应使用该子账户只读 API key。
- Weight：`20`
- 必填参数：`symbol`、`timestamp`
- 可选参数：`orderId`、`startTime`、`endTime`、`limit`、`recvWindow`
- `limit` 默认 `500`，最大 `1000`
- 限制：
  - 如果传 `orderId`，返回 order id 大于等于该值的订单。
  - 如果传 `startTime` / `endTime`，不要求 `orderId`。
  - `startTime` 与 `endTime` 的跨度不能超过 24 小时。
  - 部分历史订单的 `cummulativeQuoteQty` 可能小于 0，表示数据当前不可用。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `symbol` | 交易对 | 订单资产对 |
| `orderId` | 订单 ID | 幂等键 |
| `orderListId` | 订单列表 ID | OCO 等场景 |
| `clientOrderId` | 客户端订单 ID | 如未来系统下单，可关联计划 |
| `price` | 委托价格 | 执行偏离分析 |
| `origQty` | 原始委托数量 | 执行偏离分析 |
| `executedQty` | 已成交数量 | 订单完成度 |
| `cummulativeQuoteQty` | 累计 quote 成交额 | 订单维度统计，注意历史不可用风险 |
| `status` | 订单状态 | NEW/FILLED/CANCELED 等 |
| `timeInForce` | 订单有效方式 | 记录原始值 |
| `type` | 订单类型 | MARKET/LIMIT 等 |
| `side` | BUY/SELL | 方向 |
| `time` | 下单时间 | 订单时间 |
| `updateTime` | 更新时间 | 状态变更时间 |
| `isWorking` | 是否在订单簿工作 | 挂单状态 |
| `workingTime` | 工作时间 | 执行分析 |
| `origQuoteOrderQty` | quote 下单数量 | 市价单等场景 |
| `selfTradePreventionMode` | STP 模式 | 原样存储 |

PRD 要点：

- 订单不是持仓账本的主事实，成交 fill 才是。
- 订单用于解释“计划价 vs 实际成交”“挂单未成交”“撤单”等执行偏离。
- 同样需要按 symbol 切片同步。

### 2.11 交易对与交易规则

官方来源：[Spot Exchange information](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/general-endpoints)

调用细节：

- Method / Path：`GET /api/v3/exchangeInfo`
- Security：`NONE`
- Weight：`20`
- 可选参数：`symbol`、`symbols`、`permissions`、`showPermissionSets`、`symbolStatus`
- `symbolStatus` 支持 `TRADING`、`HALT`、`BREAK`

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `timezone` | 交易所时区 | 时间展示参考 |
| `serverTime` | 服务器时间 | 时钟校准 |
| `rateLimits[]` | 限频信息 | 调度器参考 |
| `symbols[]` | 交易对列表 | symbol 发现 |
| `symbol` | 交易对 | 同步配置 |
| `status` | 交易状态 | 过滤不可交易对 |
| `baseAsset` / `quoteAsset` | base/quote 资产 | 成交入账 |
| `baseAssetPrecision` / `quoteAssetPrecision` | 精度 | 数量处理 |
| `orderTypes[]` | 支持订单类型 | 执行分析 |
| `isSpotTradingAllowed` | 是否允许现货交易 | 过滤 |
| `filters[]` | 交易规则过滤器 | 未来下单前校验；Phase 1 只存 |
| `permissionSets` | 权限集合 | 判断 SPOT 支持 |

PRD 要点：

- 必须有本地 symbol 字典，否则 `myTrades` / `allOrders` 无法系统性同步。
- Phase 1 可先从策略资产池推导 symbol 清单，再用 `exchangeInfo` 校验。

## 3. Phase 1 建议使用或预留的 API

### 3.1 当前账户正余额资产

官方来源：[User Asset](https://developers.binance.com/docs/wallet/asset/user-assets)

调用细节：

- Method / Path：`POST /sapi/v3/asset/getUserAsset`
- Security：`USER_DATA`
- Weight：`5` IP
- 必填参数：`timestamp`
- 可选参数：`asset`、`needBtcValuation`、`recvWindow`
- 官方说明：只返回正余额数据；如果传 `asset` 则返回该资产，否则返回全部正余额资产。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `asset` | 资产 | 当前余额 |
| `free` | 可用 | 当前余额 |
| `locked` | 锁定 | 挂单占用 |
| `freeze` | 冻结 | 异常排查 |
| `withdrawing` | 提现中 | 异常排查 |
| `ipoable` | 官方返回字段 | Phase 1 原样存储 |
| `btcValuation` | BTC 估值 | 概览，不用于精确收益 |

项目建议：

- 如果子账户 API key 可调用该接口，可作为 `GET /api/v3/account` 的补充。
- 不作为 Phase 1 唯一余额来源。

### 3.2 用户钱包余额汇总

官方来源：[Query User Wallet Balance](https://developers.binance.com/docs/wallet/asset/query-user-wallet-balance)

调用细节：

- Method / Path：`GET /sapi/v1/asset/wallet/balance`
- Security：`USER_DATA`
- Weight：`60` IP
- 必填参数：`timestamp`
- 可选参数：`quoteAsset`、`recvWindow`
- `quoteAsset` 默认 `BTC`，可传 `USDT`、`ETH`、`USDC`、`BNB` 等。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `walletName` | 钱包名，如 Spot / Funding / Earn | 发现资产是否在非 Spot 钱包 |
| `balance` | 指定 quote asset 计价余额 | 资产分布概览 |
| `activate` | 钱包是否启用 | 钱包状态 |

项目建议：

- Phase 1 以 Spot 为主，但该接口可用于发现资金是否误入 Funding / Earn / Futures。
- 不用于策略收益计算。

### 3.3 普通账户充值历史

官方来源：[Deposit History](https://developers.binance.com/docs/wallet/capital/deposite-history)

调用细节：

- Method / Path：`GET /sapi/v1/capital/deposit/hisrec`
- Security：`USER_DATA`
- Weight：`1` IP
- 必填参数：`timestamp`
- 可选参数：`includeSource`、`coin`、`status`、`startTime`、`endTime`、`offset`、`limit`、`recvWindow`、`txId`
- `limit` 默认 `1000`，最大 `1000`
- 限制：默认查询最近 90 天；若同时传 `startTime` 与 `endTime`，二者间隔必须小于 90 天。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `id` | 充值记录 ID | 幂等键 |
| `amount` | 数量 | 资金流 |
| `coin` | 币种 | 资金流资产 |
| `network` | 链网络 | 审计 |
| `status` | 状态 | 入账判断 |
| `address` / `addressTag` | 地址 / tag | 审计，敏感展示需脱敏 |
| `txId` | 链上交易 ID | 追踪 |
| `insertTime` | 插入时间 | 账本时间 |
| `completeTime` | 完成时间 | 完成态时间 |
| `transferType` | 转账类型 | 原样存储 |
| `confirmTimes` | 确认数 | 状态排查 |
| `unlockConfirm` | 解锁确认数 | 状态排查 |
| `walletType` | 钱包类型 | Spot/Funding 区分 |
| `travelRuleStatus` | Travel Rule 状态 | 合规状态 |

项目建议：

- 主账户充值历史用于 master 资金入口。
- 如果资金统一先入 master，再划转到策略子账户，本接口和子账户划转历史共同构成资金注入链路。

### 3.4 普通账户提现历史

官方来源：[Withdraw History](https://developers.binance.com/docs/wallet/capital/withdraw-history)

调用细节：

- Method / Path：`GET /sapi/v1/capital/withdraw/history`
- Security：`USER_DATA`
- Weight：`18000` UID；官方同时标注请求限制 `10 requests per second`
- 必填参数：`timestamp`
- 可选参数：`coin`、`withdrawOrderId`、`status`、`offset`、`limit`、`idList`、`startTime`、`endTime`、`recvWindow`
- `limit` 默认 `1000`，最大 `1000`
- 限制：
  - 默认查询最近 90 天。
  - 若同时传 `startTime` 与 `endTime`，二者间隔必须小于 90 天。
  - 若传 `withdrawOrderId`，时间窗口必须小于 7 天。
  - `idList` 最多支持 45 个。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `id` | 提现记录 ID | 幂等键 |
| `amount` | 提现数量 | 资金流 |
| `transactionFee` | 提现手续费 | 资金流成本 |
| `coin` | 币种 | 资金流资产 |
| `status` | 状态 | 入账判断 |
| `address` | 提现地址 | 审计，敏感展示需脱敏 |
| `txId` | 链上交易 ID | 追踪 |
| `applyTime` | 申请时间 UTC | 账本时间 |
| `network` | 链网络 | 审计；旧提现可能无此字段 |
| `transferType` | 1 internal / 0 external | 资金流分类 |
| `withdrawOrderId` | 客户端提现 ID | 若系统发起提现才有；Phase 1 禁止提现 |
| `info` | 失败原因等信息 | 排查 |
| `confirmNo` | 确认数 | 状态排查 |
| `walletType` | 钱包类型 | Spot/Funding 区分 |
| `completeTime` | 完成时间 | 完成态时间 |

项目建议：

- Phase 1 不发起提现，但应同步提现历史，防止外部提现导致余额对不上。
- 如果只读 key 无法读取某些提现数据，需要在实现验证阶段记录实际权限行为。

### 3.5 普通账户内部钱包划转历史

官方来源：[Query User Universal Transfer History](https://developers.binance.com/docs/wallet/asset/query-user-universal-transfer)

调用细节：

- Method / Path：`GET /sapi/v1/asset/transfer`
- Security：`USER_DATA`
- Weight：`1` IP
- 必填参数：`type`、`timestamp`
- 可选参数：`startTime`、`endTime`、`current`、`size`、`fromSymbol`、`toSymbol`、`recvWindow`
- `size` 默认 `10`，最大 `100`
- 限制：
  - 只支持查询最近 6 个月。
  - 不传 `startTime` / `endTime` 时默认最近 7 天。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `total` | 总数 | 分页 |
| `rows[]` | 划转记录 | 钱包迁移事件 |
| `asset` | 资产 | 资金流资产 |
| `amount` | 数量 | 资金流数量 |
| `type` | 划转类型，如 `MAIN_UMFUTURE` | 钱包方向 |
| `status` | `CONFIRMED` / `FAILED` / `PENDING` | 入账状态 |
| `tranId` | 划转 ID | 幂等键 |
| `timestamp` | 时间 | 账本时间 |

项目建议：

- 用于发现 master/sub-account 内部钱包维度迁移，如 Spot 到 Funding。
- Phase 1 若只允许 Spot，不应自动把 Funding/Earn 资产计入策略持仓。

### 3.6 Convert 交易历史

官方来源：[Get Convert Trade History](https://developers.binance.com/docs/convert/trade/Get-Convert-Trade-History)

调用细节：

- Method / Path：`GET /sapi/v1/convert/tradeFlow`
- Security：`USER_DATA`
- Weight：`3000` UID
- 必填参数：`startTime`、`endTime`、`timestamp`
- 可选参数：`limit`、`recvWindow`
- `limit` 默认 `100`，最大 `1000`
- 限制：`startTime` 与 `endTime` 最大间隔 30 天。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `quoteId` | quote ID | 关联报价 |
| `orderId` | Convert 订单 ID | 幂等键 |
| `orderStatus` | 订单状态 | 只入账成功记录 |
| `fromAsset` | 换出资产 | 持仓减少 |
| `fromAmount` | 换出数量 | 持仓减少 |
| `toAsset` | 换入资产 | 持仓增加 |
| `toAmount` | 换入数量 | 持仓增加 |
| `ratio` | 兑换比例 | 成本计算参考 |
| `inverseRatio` | 反向价格 | 成本计算参考 |
| `createTime` | 创建时间 | 账本时间 |

项目建议：

- 如果用户历史上使用过 Convert，必须纳入，否则余额对账会出现缺口。
- 如果 Phase 1 禁止用 Convert，可以先预留事件类型并在对账不平时提示排查。

### 3.7 小额兑换 BNB 记录

官方来源：[DustLog](https://developers.binance.com/docs/wallet/asset/dust-log)

调用细节：

- Method / Path：`GET /sapi/v1/asset/dribblet`
- Security：`USER_DATA`
- Weight：`1` IP
- 必填参数：`timestamp`
- 可选参数：`accountType`、`startTime`、`endTime`、`recvWindow`
- `accountType`：`SPOT` 或 `MARGIN`，默认 `SPOT`
- 限制：
  - 只返回最近 100 条记录。
  - 只返回 2020-12-01 之后记录。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `total` | 记录数量 | 分页/展示 |
| `userAssetDribblets[]` | 一次小额兑换聚合 | 事件组 |
| `operateTime` | 操作时间 | 账本时间 |
| `totalTransferedAmount` | 总换得 BNB | BNB 增加 |
| `totalServiceChargeAmount` | 总服务费 | 成本 |
| `transId` | 聚合交易 ID | 幂等键 |
| `userAssetDribbletDetails[]` | 明细 | 各资产减少 |
| `fromAsset` | 换出资产 | 持仓减少 |
| `amount` | 换出数量 | 持仓减少 |
| `transferedAmount` | 换得 BNB 数量 | 持仓增加 |
| `serviceChargeAmount` | 服务费 | 成本 |

项目建议：

- 不是 Phase 1 主流程，但强烈建议预留。
- 小额兑换会改变余额，如果不记录会造成虚拟账本和 Binance 当前余额差异。

### 3.8 分红/空投/资产分发记录

官方来源：[Asset Dividend Record](https://developers.binance.com/docs/wallet/asset/assets-divided-record)

调用细节：

- Method / Path：`GET /sapi/v1/asset/assetDividend`
- Security：`USER_DATA`
- Weight：`10` IP
- 必填参数：`timestamp`
- 可选参数：`asset`、`startTime`、`endTime`、`limit`、`recvWindow`
- `limit` 默认 `20`，最大 `500`
- 限制：`startTime` 与 `endTime` 最大间隔 180 天。

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `rows[]` | 分红/分发记录 | 非交易资产变动 |
| `id` | 记录 ID | 幂等键 |
| `amount` | 数量 | 资产变动数量 |
| `asset` | 资产 | 资产维度 |
| `divTime` | 分发时间 | 账本时间 |
| `enInfo` | 英文说明 | 展示/排查 |
| `tranId` | 交易 ID | 幂等辅助 |
| `direction` | `1` 资产入账，`-1` 资产扣减 | 方向 |

项目建议：

- 作为非交易资产变动预留。
- 若账户收过空投/分发，不纳入会导致余额差异。

### 3.9 实时用户数据流

官方来源：[Spot User Data Stream](https://developers.binance.com/docs/binance-spot-api-docs/user-data-stream)

调用细节：

- 订阅方式：通过 WebSocket API 使用 API key 订阅。
- 官方说明：账户事件实时推送；JSON 时间戳默认毫秒。
- 事件类型：
  - `outboundAccountPosition`：账户余额变化。
  - `balanceUpdate`：充值、提现、账户间划转等余额变化。
  - `executionReport`：订单更新。

关键事件字段：

| 事件 | 字段 | 含义 | 项目用途 |
| --- | --- | --- | --- |
| `outboundAccountPosition` | `B[].a` | asset | 实时余额变化 |
| `outboundAccountPosition` | `B[].f` | free | 可用余额 |
| `outboundAccountPosition` | `B[].l` | locked | 锁定余额 |
| `balanceUpdate` | `a` | asset | 资产 |
| `balanceUpdate` | `d` | balance delta | 余额变化量 |
| `balanceUpdate` | `T` | clear time | 清算时间 |
| `executionReport` | `s` | symbol | 交易对 |
| `executionReport` | `S` | side | BUY/SELL |
| `executionReport` | `o` | order type | 订单类型 |
| `executionReport` | `x` | execution type | 执行类型 |
| `executionReport` | `X` | order status | 订单状态 |
| `executionReport` | `l` | last executed quantity | 本次成交数量 |
| `executionReport` | `z` | cumulative filled quantity | 累计成交数量 |
| `executionReport` | `L` | last executed price | 本次成交价格 |
| `executionReport` | `n` / `N` | commission amount / asset | 手续费 |
| `executionReport` | `t` | trade ID | 成交 ID |

项目建议：

- Phase 1 先做 REST backfill + 定时同步；WebSocket 放 Phase 1.5。
- 即使做 WebSocket，也必须保留 REST backfill，因为 WebSocket 不能替代历史重建。

## 4. 明确暂不使用的 API

### 4.1 真实划转接口

官方来源：[Universal Transfer for Master Account](https://developers.binance.com/docs/sub_account/asset-management/Universal-Transfer)

调用细节：

- Method / Path：`POST /sapi/v1/sub-account/universalTransfer`
- Security：`USER_DATA`
- Weight：`1` IP、`360` UID
- 参数包括 `fromEmail`、`toEmail`、`fromAccountType`、`toAccountType`、`asset`、`amount`、`clientTranId`、`timestamp` 等。
- 官方说明：调用此接口需要为 API key 开启 internal transfer 选项。

项目决策：

- Phase 1 不自动发起资金划转，只读同步和人工操作。
- 可在 PRD 中记录未来能力，但当前实现不需要调用 `POST`。
- 如果未来接入，必须单独做权限、审计、幂等、人工确认与错误恢复设计。

### 4.2 交易接口

官方 Spot Request Security 文档说明 `TRADE` 权限用于下单/撤单，默认 API key 不能交易，需要额外开启。  
来源：[Spot Request Security](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/request-security)

项目决策：

- Phase 1 禁止使用任何 `TRADE` endpoint。
- 只同步用户在 Binance 手动完成的订单和成交。

### 4.3 合约 / 杠杆 / 期权接口

项目 Phase 1 明确只做加密现货，不碰合约、杠杆、做空、期权。即使 Binance 子账户文档提供 Futures / Margin / Options 相关查询，Phase 1 不纳入。

## 5. 推荐本地数据模型

### 5.1 `exchange_account`

用途：保存 Binance master / sub-account 映射。

建议字段：

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `id` | 本地 ID | 系统生成 |
| `exchange` | `BINANCE` | 系统枚举 |
| `account_role` | `MASTER` / `SUB_ACCOUNT` | 系统枚举 |
| `sub_user_id` | 子账户 ID | `GET /sapi/v1/sub-account/list.subUserId` |
| `email` | 子账户邮箱 / 虚拟邮箱 | `GET /sapi/v1/sub-account/list.email` |
| `remark` | 备注 | `GET /sapi/v1/sub-account/list.remark` |
| `is_freeze` | 是否冻结 | `GET /sapi/v1/sub-account/list.isFreeze` |
| `bound_strategy_id` | 绑定策略 | 系统维护 |
| `created_at_exchange` | Binance 创建时间 | `createTime` |

### 5.2 `api_key_health_check`

用途：记录 API key 权限检查结果，不保存 secret。

建议字段：

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `exchange_account_id` | 所属账户 | 系统关联 |
| `checked_at` | 检查时间 | 系统生成 |
| `ip_restrict` | 是否 IP 限制 | `apiRestrictions.ipRestrict` |
| `enable_reading` | 是否可读 | `apiRestrictions.enableReading` |
| `enable_withdrawals` | 是否可提现 | `apiRestrictions.enableWithdrawals` |
| `enable_spot_and_margin_trading` | 是否可交易 | `apiRestrictions.enableSpotAndMarginTrading` |
| `enable_internal_transfer` | 是否内部划转 | `apiRestrictions.enableInternalTransfer` |
| `permits_universal_transfer` | 是否 universal transfer | `apiRestrictions.permitsUniversalTransfer` |
| `risk_level` | `OK` / `WARN` / `BLOCK` | 系统判定 |

### 5.3 `account_balance_snapshot`

用途：保存每次从 Binance 拉取的当前余额。

建议字段：

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `exchange_account_id` | Binance master/sub account | 系统关联 |
| `snapshot_time` | 本地采集时间 | 系统生成 |
| `source_endpoint` | 来源接口 | 如 `/api/v3/account` 或 `/sapi/v3/sub-account/assets` |
| `asset` | 币种 | `asset` |
| `free` | 可用 | `free` |
| `locked` | 锁定 | `locked` |
| `freeze` | 冻结 | 子账户资产接口 |
| `withdrawing` | 提现中 | 子账户资产接口 |
| `raw_payload` | 原始响应 | 原样存储 |

### 5.4 `exchange_order`

用途：订单维度事实，用于执行偏离解释。

建议字段：

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `exchange_account_id` | 子账户 | 系统关联 |
| `symbol` | 交易对 | `allOrders.symbol` |
| `order_id` | Binance 订单 ID | `orderId` |
| `client_order_id` | 客户端订单 ID | `clientOrderId` |
| `side` | BUY/SELL | `side` |
| `type` | MARKET/LIMIT 等 | `type` |
| `status` | 订单状态 | `status` |
| `price` | 委托价格 | `price` |
| `orig_qty` | 原始数量 | `origQty` |
| `executed_qty` | 已成交数量 | `executedQty` |
| `cummulative_quote_qty` | 累计 quote 成交额 | `cummulativeQuoteQty` |
| `time` | 下单时间 | `time` |
| `update_time` | 更新时间 | `updateTime` |
| `raw_payload` | 原始响应 | 原样存储 |

### 5.5 `exchange_trade_fill`

用途：现货成交事实，是持仓和成本计算主来源。

建议字段：

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `exchange_account_id` | 子账户 | 系统关联 |
| `strategy_id` | 绑定策略 | 由子账户绑定推导 |
| `symbol` | 交易对 | `myTrades.symbol` |
| `trade_id` | Binance trade id | `id` |
| `order_id` | Binance order id | `orderId` |
| `price` | 成交价 | `price` |
| `qty` | base 数量 | `qty` |
| `quote_qty` | quote 数量 | `quoteQty` |
| `commission` | 手续费数量 | `commission` |
| `commission_asset` | 手续费资产 | `commissionAsset` |
| `time` | 成交时间 | `time` |
| `is_buyer` | 是否买方 | `isBuyer` |
| `is_maker` | 是否 maker | `isMaker` |
| `raw_payload` | 原始响应 | 原样存储 |

幂等键：`exchange_account_id + symbol + trade_id`。

### 5.6 `capital_flow_event`

用途：记录所有非成交资产变化。

建议事件类型：

- `MASTER_SUB_TRANSFER`
- `SUB_DEPOSIT`
- `MASTER_DEPOSIT`
- `WITHDRAW`
- `WALLET_TRANSFER`
- `CONVERT`
- `DUST`
- `DIVIDEND`

建议字段：

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `exchange_account_id` | 发生账户 | 系统关联 |
| `strategy_id` | 若绑定策略则填 | 系统推导 |
| `event_type` | 事件类型 | 系统枚举 |
| `external_id` | Binance 记录 ID / tranId / orderId | 各接口 |
| `asset` | 资产 | 各接口 |
| `amount` | 数量，流入为正，流出为负 | 系统标准化 |
| `fee_asset` | 手续费资产 | 提现/Convert/Dust 等 |
| `fee_amount` | 手续费数量 | 提现/Convert/Dust 等 |
| `from_account` | 来源账户 | 划转接口 |
| `to_account` | 目标账户 | 划转接口 |
| `network` | 链网络 | 充值/提现 |
| `tx_id` | 链上交易 ID | 充值/提现 |
| `event_time` | 账本时间 | 各接口时间字段 |
| `status` | 原始状态 | 各接口 |
| `raw_payload` | 原始响应 | 原样存储 |

### 5.7 `sync_cursor`

用途：断点续跑和限频控制。

建议字段：

| 字段 | 说明 |
| --- | --- |
| `exchange_account_id` | 哪个 Binance 账户 |
| `endpoint` | 同步接口 |
| `symbol` | 交易对；非 symbol 接口可为空 |
| `cursor_type` | `from_id` / `time_window` / `page` |
| `last_trade_id` | `myTrades` 游标 |
| `last_order_id` | `allOrders` 游标 |
| `last_start_time` / `last_end_time` | 时间切片 |
| `last_success_at` | 上次成功 |
| `last_error` | 最近错误 |

## 6. 同步策略建议

### 6.1 首次 backfill

1. 用 master key 调 `GET /sapi/v1/sub-account/list` 建立子账户列表。
2. 用户在系统中把策略绑定到子账户。
3. 对每个子账户保存只读 API key，并运行 `GET /sapi/v1/account/apiRestrictions` 检查权限。
4. 拉取子账户当前余额：
   - master key：`GET /sapi/v3/sub-account/assets`
   - 子账户 key：`GET /api/v3/account`
5. 建立 symbol 清单：
   - 从策略资产池推导交易对；
   - 用 `GET /api/v3/exchangeInfo` 校验。
6. 对每个子账户、每个 symbol：
   - `GET /api/v3/myTrades`
   - `GET /api/v3/allOrders`
7. 拉取资金流：
   - master/sub 划转：`GET /sapi/v1/sub-account/universalTransfer`
   - 子账户充值：`GET /sapi/v1/capital/deposit/subHisrec`
   - master 充值：`GET /sapi/v1/capital/deposit/hisrec`
   - 提现：`GET /sapi/v1/capital/withdraw/history`
8. 生成虚拟账本余额，与 Binance 当前余额快照对账。

### 6.2 增量同步

- `myTrades`：优先使用 `fromId` 游标；若按时间窗口补漏，窗口必须小于 24 小时。
- `allOrders`：使用 `orderId` 或小于 24 小时时间窗口。
- `sub-account/universalTransfer`：时间窗口必须小于 7 天。
- `deposit/withdraw`：时间窗口小于 90 天。
- `convert/tradeFlow`：时间窗口不超过 30 天。
- `assetDividend`：时间窗口不超过 180 天。

### 6.3 对账逻辑

对每个策略子账户：

- 外部当前余额 = Binance balance snapshot。
- 内部推导余额 = trade fills + capital flow events + fees。
- 若差异为 0 或小于资产精度阈值：`MATCHED`。
- 若外部有余额但内部无事件：`MISSING_EVENT`。
- 若内部有资产但外部无余额：`EXTERNAL_BALANCE_MISMATCH`。
- 若存在未同步 Convert / Dust / Dividend / Funding / Earn 资产：`NEEDS_CLASSIFICATION`。

## 7. PRD 必须写清的限制

- Phase 1 的实盘策略上限是 Binance 普通子账户数量限制，不是系统永久策略数量限制。
- 当前余额快照不是历史账本，只能作为展示和对账目标。
- `myTrades` / `allOrders` 必须按 `symbol` 查询，没有一个官方 Spot endpoint 能按账户一次返回全部历史成交。
- 子账户策略归属天然来自 `exchange_account -> strategy` 绑定，但成本、收益率、手续费、滑点、执行偏离仍必须由本系统计算。
- 资金流不仅有成交，还包括充值、提现、主子账户划转、钱包划转、Convert、小额兑换、分红/空投。
- 同步器必须支持时间切片、分页、游标和幂等。
- Phase 1 不使用交易接口，不发起划转，不申请提现权限。

## 8. 最小 API 清单

Phase 1 必须实现：

| 目的 | API |
| --- | --- |
| API key 权限检查 | `GET /sapi/v1/account/apiRestrictions` |
| 子账户发现 | `GET /sapi/v1/sub-account/list` |
| 子账户资产余额 | `GET /sapi/v3/sub-account/assets` |
| 子账户资产汇总 | `GET /sapi/v1/sub-account/spotSummary` |
| 主子账户划转历史 | `GET /sapi/v1/sub-account/universalTransfer` |
| 子账户充值历史 | `GET /sapi/v1/capital/deposit/subHisrec` |
| Spot 当前账户信息 | `GET /api/v3/account` |
| Spot 成交明细 | `GET /api/v3/myTrades` |
| Spot 订单历史 | `GET /api/v3/allOrders` |
| 交易对字典 | `GET /api/v3/exchangeInfo` |

Phase 1 建议同步或预留：

| 目的 | API |
| --- | --- |
| 主账户充值历史 | `GET /sapi/v1/capital/deposit/hisrec` |
| 提现历史 | `GET /sapi/v1/capital/withdraw/history` |
| 钱包划转历史 | `GET /sapi/v1/asset/transfer` |
| 正余额资产 | `POST /sapi/v3/asset/getUserAsset` |
| 钱包余额概览 | `GET /sapi/v1/asset/wallet/balance` |
| Convert 历史 | `GET /sapi/v1/convert/tradeFlow` |
| 小额兑换记录 | `GET /sapi/v1/asset/dribblet` |
| 分红/空投记录 | `GET /sapi/v1/asset/assetDividend` |
| 实时增量事件 | Spot User Data Stream |
