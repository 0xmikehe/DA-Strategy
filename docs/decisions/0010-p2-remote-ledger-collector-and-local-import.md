# ADR-0010: P2 远端受控账本采集与本地导入拓扑

- 状态：Accepted
- 日期：2026-06-24
- 决策者：hashmike + Codex
- 涉及层：全局（ledger / signal / strategy / docs）

## 背景

ADR-0006 已确定本项目稳定期会迁移到长期在线的 Linux 机器，运行形态包含 `app`、`worker`、`postgres`，并以低频 REST 采集、账本同步、信号快照、策略回放和只读 UI 为主。

P2 开始账本层会从 fixture 骨架进入真实账户事实同步。与此同时，本地开发仍需要保持可重复、可离线、可在默认验证门中稳定运行；真实外部数据源、只读账户 key、游标推进、对账和备份恢复则更适合放在未来正式运行的远端机器上。

因此需要冻结一条运行拓扑：远端负责真实采集和长期事实沉淀，本地负责开发、回放、导入验证和 UI 调试。这个设计强调正式运行面与开发面的职责边界，而不是为某个外部 API 做透明转发。

## 决策

P2 采用 **Remote Ledger Collector + Local Import Kit**：

1. **远端是正式采集运行面**
   远端机器运行完整系统或至少运行 `worker + postgres`，持有只读 Binance 账户 key，负责 signed API 调用、key health check、限频、游标、幂等写入、余额快照、对账和备份。

2. **本地是可重复开发面**
   本地默认使用 fixture / mock / cassette / imported data，不直接依赖 Binance live 网络，不持有真实账户 secret。`npm run verify` 必须保持离线可运行。

3. **不做透明 Binance API proxy**
   本项目不提供 `/api/binance/*` 这类透传 endpoint，也不在本地模拟 Binance 官方 API 作为业务主接口。远端只暴露项目自有的账本导出能力，输出标准化账本包。

4. **远端导出账本包，本地导入账本包**
   远端导出的单位称为 `ledger_export_package`，内容是账本层领域数据与同步摘要，而不是 Binance 原始响应：
   - `manifest`
   - `exchange_account` 脱敏摘要
   - `api_key_health_summary`
   - `ledger_event`
   - `exchange_trade_fill`
   - `exchange_order`
   - `capital_flow_event`
   - `account_balance_snapshot`
   - `reconciliation_result`
   - `sync_cursor_summary`
   - 可选 `raw_payload_redacted`

5. **本地导入必须幂等且可追溯**
   本地 importer 校验 `schema_version`、`content_hash`、`export_run_id`、`source_env_id` 后写入本地 DB。重复导入同一包不得重复入账；所有导入批次保留导入记录。

6. **数据来源必须显式展示**
   read model 和页面需要区分 `fixture` / `mock` / `cassette` / `remote_import` / `live`。本地 imported data 不得在 UI 上伪装成 live。

7. **真实同步仍需显式触发**
   默认本地和 CI 验证门不触发 live Binance 请求。live smoke、远端同步、远端导出、真实账号对账必须由人显式触发。

## 备选方案

### 方案 A：透明 API 中转

本地请求远端 `/api/binance/*`，远端代调 Binance 并把原始响应透传回来。

不选。该方案会把远端变成自建 Binance proxy，难以约束 endpoint 范围、raw payload 泄漏、签名参数、限频和审计边界；本地开发也会不知不觉依赖 live 网络。

### 方案 B：本地完整 mock Binance API

本地实现一套尽量完整的 Binance API mock，业务代码像调用 Binance 一样调用 mock。

部分采用，但不作为主架构。mock 适合覆盖错误、限频、重复数据、断点续跑和合约测试；但长期维护一套官方 API 兼容层成本高，且不能替代远端真实采集得到的账本事实。

### 方案 C：只在远端开发和运行

所有开发、调试、采集、UI 都在远端机器上完成。

不选为唯一路径。远端是正式运行面，但本地仍需要稳定开发体验、离线验证门、fixture/cassette 回归测试和快速 UI 调试。

## 影响

- P2 账本同步实现前，必须先定义 `ledger_export_package` 契约、导出/导入幂等键、脱敏规则和数据来源枚举。
- 账本层 PRD 需要补充“远端采集与本地导入”章节，说明 live 同步、mock、cassette、remote import 的职责边界。
- `AGENTS.md` 的默认验证门继续保持离线；新增 live/remote 命令必须命名为显式 opt-in。
- 远端首次真实账户同步前，仍必须满足 ADR-0006 的备份与恢复演练门槛。
- 后续实现不得引入透明 Binance proxy，也不得让 strategy / signal 绕过账本导入契约直接消费远端账户 API。
