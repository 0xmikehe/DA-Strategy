# Binance 行情（市场数据）API 调研

> 目的：在写信号层 PRD 第 3 章「输入维度与数据源」之前，先把 **Binance 这一个数据源**能给信号层喂什么搞清楚——由接口现实决定信号范围，而不是拍脑袋。对标 `binance-account-api-research.md` 的格式与力度。
> 边界：本篇**只覆盖 Binance 行情接口**（Spot 市场数据 + 衍生品**只读**市场数据）。ETF 资金流、美股宏观、X/社交情绪**不是 Binance 接口**，是另外的数据源，各自单独调研，不在本篇。
> 红线核对：读衍生品**公开行情**（资金费率/持仓量/多空比）**不违反**「不碰合约/杠杆/做空」红线——红线是不**交易**衍生品；这些是公开市场数据，security=NONE，无需任何 key。见立项书边界红线、ADR-0004 决策 1。

## 0. 方法与可信度声明

- 本篇为**文档核对级**调研：逐条对照 Binance 官方开发者文档（`developers.binance.com`）抄录方法/路径/权重/参数/响应字段，**以官方文档为准**。
- **线上实测统一推迟**（项目决定）：协作/CI 环境出口 IP 落在 Binance 限制区（美国等），`api.binance.com` / `fapi.binance.com` 一律返回 `Service unavailable from a restricted location`，无法在此环境实测。因此本项目**所有 Binance API 的线上实测（账户 + 行情）统一推迟到后续在非限制区环境集中进行**，文档阶段一律按官方文档推进、不被实测阻塞。各文档把需实测核对的点收集到「待实测确认」清单（本篇见 §6），到时一并验证。与 ADR-0003 标注「以 API 实测为准」是同一处理。
- 行情接口绝大多数 `security = NONE`（公开、无需 key）。这对信号层是好事：**信号层取行情数据不需要账户 key**，天然满足「信号层对账户事实库零依赖」（ADR-0004 决策 1）。

---

## 1. 结论：Binance 能给信号层喂什么

按信号层维度归类（维度本身的选型在信号层 PRD，本篇只回答「数据拿不拿得到」）：

| 信号维度 | 可用 Binance 数据 | 接口族 | Phase 1 可落地性 |
| --- | --- | --- | --- |
| BTC/ETH 趋势结构 | K 线（开高低收量） | Spot `klines` | ✅ 高，免费、可深度回填 |
| ETH/BTC 强弱 | 两条 K 线相除或直接 `ETHBTC` 交易对 | Spot `klines` | ✅ 高 |
| 价格/涨跌/成交量快照 | 24hr / 滚动窗口 ticker | Spot `ticker/*` | ✅ 高 |
| 衍生品情绪 - 资金费率 | 资金费率历史 | `fapi/v1/fundingRate` | ✅ 中，可回填 |
| 衍生品情绪 - 持仓量 | 持仓量统计 | `futures/data/openInterestHist` | ⚠️ 中，**仅近 1 个月**可回填 |
| 衍生品情绪 - 多空比 | 全网/大户 多空账户比、持仓比 | `futures/data/*LongShort*` | ⚠️ 中，**仅近 1 个月**可回填 |
| 衍生品情绪 - 主动买卖 | taker 主动买卖量比 | `futures/data/takerBuySellVol` | ⚠️ 中，**仅近 1 个月**可回填 |
| 稳定币资金流 | ❌ **Binance 行情接口拿不到**（需链上/CMC 等外部源） | — | 另源调研 |
| ETF 资金流 / 美股宏观 | ❌ 非 Binance | — | 另源调研 |

**两条关键结论先行：**

1. **K 线类（Spot）是 Phase 1 的地基**：免费、无需 key、权重低（2）、可回填到很早，最适合做趋势/强弱类可证伪信号，也最适合回测。
2. **衍生品情绪类（`futures/data/*`）有一个致命约束：官方只保留近 1 个月历史**（见 §3）。这意味着这些信号**无法长期回填回测**——一旦决定用，必须**从上线那天起自己持续抓取落库**，否则历史就永久丢了。这直接影响信号层 PRD 的取舍与「影子期」设计。

---

## 2. Phase 1 地基接口（Spot 市场数据，security=NONE）

### 2.1 K 线 / 蜡烛图（最重要）

官方来源：[Kline/Candlestick Data](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)

调用细节：

- Method / Path：`GET /api/v3/klines`
- Security：`NONE`
- Weight：`2`
- 必填参数：`symbol`、`interval`
- 可选参数：`startTime`、`endTime`、`timeZone`（默认 0 UTC）、`limit`（默认 500，最大 1000）
- 支持 `interval`：`1s`、`1m`–`30m`、`1h`–`12h`、`1d`/`3d`、`1w`、`1M`

关键响应字段（**数组**，按下标取值——顺序待实测确认，见 §6）：

| 下标 | 含义 | 项目用途 |
| --- | --- | --- |
| 0 | 开盘时间 | 时间轴 |
| 1 / 2 / 3 / 4 | 开 / 高 / 低 / 收 | 趋势结构、均线、突破判定 |
| 5 | 成交量(base) | 量能信号 |
| 6 | 收盘时间 | 切片对齐 |
| 7 | 成交额(quote) | 量能信号 |
| 8 | 成交笔数 | 活跃度 |
| 9 / 10 | taker 主动买入 base / quote 量 | 主动买盘占比（现货版情绪） |

PRD 要点：
- 信号层取价格/趋势数据**只需要 K 线**，无需账户 key、无需深度/逐笔。
- 回填能力强（可用 `startTime` 翻很早），是趋势/强弱类信号回测的主力数据。
- `uiKlines`（`GET /api/v3/uiKlines`，weight 2，参数同）是「展示优化版」，信号计算用 `klines` 即可，无需 `uiKlines`。

### 2.2 24 小时价格变动统计（快照/概览）

官方来源：[24hr Ticker Price Change Statistics](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)

调用细节：

- Method / Path：`GET /api/v3/ticker/24hr`
- Security：`NONE`
- Weight：单 symbol `2`；多 symbol / 全市场 `40`–`80`
- 可选参数：`symbol`、`symbols`、`type`（`FULL`/`MINI`）、`symbolStatus`

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `lastPrice` | 最新价 | 快照取值 |
| `priceChangePercent` | 24h 涨跌幅 | 概览/简单信号 |
| `weightedAvgPrice` | 加权均价 | 参考 |
| `highPrice`/`lowPrice` | 24h 高/低 | 区间位置 |
| `volume`/`quoteVolume` | 24h 量/额 | 量能 |
| `openTime`/`closeTime` | 窗口边界 | 对齐 |

PRD 要点：
- 用于「市场页」概览与轻量信号；**全市场拉取权重高（40–80）**，Phase 1 只取关注的少量 symbol，别无脑全市场拉。

### 2.3 滚动窗口统计（可选）

- Method / Path：`GET /api/v3/ticker`，Security `NONE`，Weight `4`/symbol（上限 200）
- 必填 `symbol` 或 `symbols`（最多 100）；可选 `windowSize`（`1m`–`59m`/`1h`–`23h`/`1d`–`7d`）
- 用途：自定义窗口涨跌幅（如 7d 动量）。Phase 1 多数能用 K 线自算，**列为预留**。

### 2.4 其它 Spot 行情接口（Phase 1 不必用，登记备查）

| 接口 | Path | Weight | Phase 1 |
| --- | --- | --- | --- |
| 最新价 | `GET /api/v3/ticker/price` | 2/4 | 预留（K 线收盘价已够） |
| 最优挂单 | `GET /api/v3/ticker/bookTicker` | 2/4 | 不用 |
| 深度/订单簿 | `GET /api/v3/depth` | 5–250 | 不用（微观结构，Phase 1 不做） |
| 近期成交 | `GET /api/v3/trades` | 25 | 不用 |
| 归集成交 | `GET /api/v3/aggTrades` | 4 | 不用 |
| 当前均价 | `GET /api/v3/avgPrice` | 2 | 预留 |
| 交易对规则 | `GET /api/v3/exchangeInfo` | 20 | 复用（symbol 字典，账本层已用） |

---

## 3. 衍生品情绪接口（只读，security=NONE）— ⚠️ 带 1 个月保留约束

> 红线再确认：以下全部是**读公开市场数据**，无需 key、不下单、不持仓，**不触碰**「不碰合约」红线。

### 3.1 资金费率历史

官方来源：[Get Funding Rate History](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History)

调用细节：

- Method / Path：`GET /fapi/v1/fundingRate`
- 主机：`fapi.binance.com`（U 本位合约）
- Weight：与 `GET /fapi/v1/fundingInfo` **共享** 500/5min/IP 限额
- 可选参数：`symbol`、`startTime`、`endTime`、`limit`（默认 100，最大 1000；不传时间则返回最近 200 条）
- 结算周期：约 **8 小时**一次（按示例时间戳推断，部分 symbol 可能不同，见 `fundingInfo`）——**待实测确认**

关键响应字段：

| 字段 | 含义 | 项目用途 |
| --- | --- | --- |
| `symbol` | 合约 | — |
| `fundingRate` | 资金费率 | 多空成本/情绪：正=多头付费(偏多拥挤) |
| `fundingTime` | 结算时间(ms) | 时间轴 |
| `markPrice` | 标记价 | 参考 |

PRD 要点：**可回填**（历史资金费率长期保留），适合做可回测的情绪信号。

### 3.2 持仓量统计

官方来源：[Open Interest Statistics](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest-Statistics)

调用细节：

- Method / Path：`GET /futures/data/openInterestHist`
- Weight：`0`；限频 1000 请求 / 5min
- 必填：`symbol`、`period`（`5m`/`15m`/`30m`/`1h`/`2h`/`4h`/`6h`/`12h`/`1d`）
- 可选：`limit`（默认 30，最大 500）、`startTime`、`endTime`
- ⚠️ **保留窗口：官方明确「只有最近 1 个月数据可用」**

关键响应字段：`sumOpenInterest`（持仓量）、`sumOpenInterestValue`（名义价值）、`CMCCirculatingSupply`、`timestamp`。

> 当前**瞬时**持仓量另有 `GET /fapi/v1/openInterest`（单点快照），统计历史用上面的 `openInterestHist`。

### 3.3 多空比族（全网账户比 / 大户账户比 / 大户持仓比）

官方来源：[Long/Short Ratio](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Long-Short-Ratio)

| 指标 | Path | 含义 |
| --- | --- | --- |
| 全网多空账户比 | `GET /futures/data/globalLongShortAccountRatio` | 散户情绪（常作反向指标） |
| 大户多空账户比 | `GET /futures/data/topLongShortAccountRatio` | 大户按账户数 |
| 大户多空持仓比 | `GET /futures/data/topLongShortPositionRatio` | 大户按持仓量（更接近真金白银） |
| 主动买卖量比 | `GET /futures/data/takerBuySellVol` | taker 主动买/卖盘力量 |

共同调用细节：Weight `0`；必填 `symbol`、`period`（同 §3.2 枚举）；可选 `limit`（默认 30，最大 500）、`startTime`、`endTime`。
`globalLongShortAccountRatio` 响应：`longShortRatio`、`longAccount`、`shortAccount`、`timestamp`。

⚠️ **保留窗口：同样只有最近 1 个月**（`futures/data/*` 全族通病）。

---

## 4. 明确不使用 / 暂不纳入

- **任何下单/持仓/账户接口**（`fapi` 的 trade/account 段）：红线，且信号层零账户依赖。
- **深度、逐笔、归集成交**：微观结构信号 Phase 1 不做。
- **WebSocket 行情流**：Phase 1 信号按**周期轮询 REST** 即可（信号判定是低频的，分钟/小时级），实时流留作未来低延迟需求时再引入，不进 Phase 1。
- **COIN-M（币本位）合约数据**：Phase 1 只看 U 本位（`fapi`）主流币情绪即可。

---

## 5. 关键约束与坑（PRD 必须写清）

1. **地理限制**：Binance 对部分地区 IP 直接拒服务（本调研已撞到）。部署/抓数环境的**出口 IP 必须在非限制区**，否则信号层取不到任何数据。这是上线前的硬前提。
2. **情绪历史不可回填（最致命）**：`futures/data/*`（持仓量、多空比、主动买卖）**只保留近 1 个月**。结论：**任何基于这些指标的信号，必须从上线第一天起自建持续抓取 + 落库**，否则永久失去历史，无法回测。这恰好印证 ADR-0004「影子期先攒回测数据」的必要性——这类信号天生没有冷启动回测，只能靠影子期慢慢攒。
3. **K 线可深度回填**：相反，Spot K 线与资金费率历史可向前拉很久，趋势/强弱/费率类信号能用历史直接回测——Phase 1 优先做这类「可冷启动回测」的信号。
4. **权重/限频分桶**：Spot 走 IP 权重池（K 线仅 2，全市场 ticker 40–80）；`futures/data/*` 权重 0 但限 1000 请求/5min；资金费率与 `fundingInfo` 共享 500/5min。信号层是低频轮询，正常用量远不触顶，但调度器仍应集中取数、避免全市场无脑拉。
5. **无需 key = 与账本同步解耦**：行情抓取不carry 任何账户 key，可独立于账本同步管道单独调度，符合分层。

---

## 6. 待实测确认（在非限制区环境跑一遍）

- [ ] `klines` 返回数组的**字段顺序与个数**（本篇按官方文档下标，需实跑核对，尤其下标 9/10 taker 量与下标 11 ignore）。
- [ ] 各接口**确切 weight** 与限频桶归属（24hr 全市场是 40 还是 80、随 symbol 数怎么变）。
- [ ] `futures/data/*` 的 **1 个月保留**是否对所有 `period` 一致，能否用 `startTime` 多页翻满 1 个月。
- [ ] 资金费率**结算周期**：哪些主流 symbol 是 8h、是否存在 4h/1h（查 `fundingInfo`）。
- [ ] `topLongShortPositionRatio` / `takerBuySellVol` 的**完整响应字段**（本篇仅确认路径与公共参数）。
- [ ] 主机连通性：`api.binance.com` vs 行情专用镜像 `data-api.binance.vision` 在你的环境是否都可达。

---

## 7. 最小接口清单（信号层 Phase 1 起步）

| 优先级 | 接口 | 喂给什么信号 | 回测可冷启动？ |
| --- | --- | --- | --- |
| P0 | `GET /api/v3/klines` | BTC/ETH 趋势结构、ETH/BTC 强弱 | ✅ 是 |
| P0 | `GET /api/v3/exchangeInfo` | symbol 字典（账本层已用，复用） | — |
| P1 | `GET /fapi/v1/fundingRate` | 资金费率情绪 | ✅ 是 |
| P1 | `GET /api/v3/ticker/24hr` | 市场页概览 / 轻量信号 | 部分 |
| P2（需影子期攒数） | `futures/data/openInterestHist` | 持仓量变化 | ❌ 否，仅近 1 月 |
| P2（需影子期攒数） | `futures/data/globalLongShortAccountRatio` 等 | 多空比情绪 | ❌ 否，仅近 1 月 |

> 给信号层 PRD 第 3 章的建议：**P0/P1 先做（可冷启动回测的趋势/费率类）**；P2 情绪类若要做，从上线起进「观察/影子」态持续落库攒历史，够格再启用（ADR-0004 三态生命周期）。
