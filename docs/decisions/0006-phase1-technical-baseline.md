# ADR-0006: Phase 1 技术栈与运行基线

- 状态：Accepted
- 日期：2026-06-19
- 决策者：hashmike + Codex
- 涉及层：全局（ledger / signal / strategy / docs）

## 背景

Phase 1 的核心不是先把所有功能做宽，而是在 6-8 周时间盒内跑通「骨架」：账本事实可进入、信号快照可生成、策略能基于启用态信号与账本事实产出可复盘的决策视图。这个骨架对应实施计划中的 P0 + P1，并作为立项书 §19.2「失效条件」的 go / no-go 闸门；P2-P7 是加宽，不受这个时间盒约束。

本项目是自用的数字资产投资操作系统，不是公开多租户 SaaS。初期在本机开发与运行，稳定后迁移到一台长期在线的 Linux 机器。系统形态是低频 REST 采集、账本同步、信号快照、策略回放、只读 UI 与少量人工维护操作；第一阶段只使用 Binance 来源数据，只读 API，不做自动下单，不触碰合约 / 杠杆 / 做空 / 期权。

同时，部分 Binance `futures/data/*` 公开端点只有约 1 个月历史保留，且受出口网络影响较大。OI / 多空比等影子采集器必须在有可用非限制区出口时尽早常驻，避免不可再生的历史窗口流失。

## 决策

### 1. 技术栈：TypeScript 全栈 + Next.js App Router

- Phase 1 采用 **TypeScript 全栈**，Web / API / worker 共享类型与契约定义。
- 前端与 BFF 使用 **Next.js App Router + React**。页面负责展示与轻量交互，所有领域行为经服务层进入，不在页面组件里绕过层边界。
- 领域目录沿用三层边界：`src/ledger/`、`src/signal/`、`src/strategy/`。跨层只通过 ADR-0007 定义的契约对象通信。
- Python 可作为离线研究 / 回测脚本的辅助工具，但不进入 Phase 1 主服务链路。

### 2. 数据库：PostgreSQL 固定，不做 SQLite / Postgres 双库

- Phase 1 主数据库固定为 **PostgreSQL**。本机开发、CI、长期运行环境都使用 Postgres；CI 使用一次性 Postgres 实例。
- 不做 SQLite / Postgres 双库兼容，避免两套 SQL 语义、事务行为、Decimal 表达和迁移路径。
- 固定 Postgres 的理由：
  - Web + worker 会并发写入，需要明确事务与锁语义。
  - 财务数量、价格、费用、仓位必须用 `NUMERIC` 保真，不能依赖浮点。
  - 决策快照、原始响应摘要、数据质量元信息需要 JSONB / 索引能力。
  - 账本事实、成交、快照属于不可丢失的「圣数据」，不应从轻量库迁移到正式库时再承担迁移风险。

### 3. ORM / SQL：Prisma 优先，保留 raw SQL 逃生口

- Phase 1 采用 **Prisma** 管理 schema、迁移与常规查询；类型生成帮助多 agent 在同一契约下工作。
- 对账、回放、批量幂等 upsert、锁竞争等 Prisma 表达不清的场景，允许在仓储层使用 raw SQL。
- 金额、价格、数量、费用、成本基础等在 DB 中使用 `NUMERIC`，在 TypeScript DTO 中使用 Decimal 对象或字符串序列化；跨层 DTO 不使用 JS `number` 表达财务数值。
- 若实现前发现 Prisma 阻塞核心回放或迁移透明性，需另写 ADR 推翻本决策，不得在代码中静默改用另一套 ORM。

### 4. Worker / 调度：独立 Node worker + Postgres 作业表

- Phase 1 使用独立 **Node worker 进程**处理账本同步、信号事实采集、快照生成、复盘草稿生成等后台任务。
- Web 进程与 worker 进程共享同一 Postgres，但通过作业表、游标表、幂等键和状态机协调；不共享内存。
- Phase 1 不引入 Redis / BullMQ / Kafka。作业调度先用 Postgres 表 + worker 轮询 + retry / backoff / freshness 检查实现。
- 第一版作业表至少覆盖：`job_run`、`sync_cursor`、失败原因、重试次数、开始 / 结束时间、数据新鲜度标记。
- 调度与 worker 属 ADR-0006 范围；跨层快照与 DTO 属 ADR-0007 范围。

### 5. 部署形态：本机起步，Linux 常驻

- 开发期允许在当前本机运行 Web、worker、Postgres。
- 稳定运行期迁移到一台长期在线的 Linux 机器，推荐 Ubuntu Server LTS + Docker Compose。
- 长期运行形态至少包含：`app`、`worker`、`postgres` 三个进程 / 服务；由 Docker Compose 或 systemd 保活。
- 机器必须满足：不休眠、稳定电源、稳定出口网络、可 SSH、可备份、可观察磁盘容量。
- Phase 1 不以 Vercel / serverless cron 作为主运行环境，因为常驻采集器、出口网络、数据库备份和本地只读 key 管理都需要更强控制权。

### 6. 访问保护：本机 / 内网访问，不做完整账号系统

- Phase 1 不做完整多用户登录、注册、权限系统。
- 默认访问边界是本机或可信内网。若需要离开本机访问，优先使用 SSH tunnel、Tailscale、反向代理 Basic Auth 等网络层保护。
- UI 只提供系统操作台能力，不提供外部信号推送通道；信号推送不属于 Phase 1。
- 任何访问方式都不得暴露 API key、secret、签名参数、账户敏感响应。

### 7. 密钥：`.env` + `key_ref`，仓库和数据库不存明文

- Binance key / secret 存在本机 `.env`，文件不入库并设置 `chmod 600`。
- 数据库与 git 只保存 `key_ref`，即环境变量名或密钥别名，不保存 secret 明文。
- 仓库可包含 `.env.example`，只列变量名与用途，不填真实值。
- 日志、错误、作业表、前端响应不得打印 secret、签名、完整 header 或敏感账户原文。
- `key_ref` 抽象保留未来迁移到 Keychain / 1Password / KMS 的路径，但 Phase 1 不为此增加复杂度。

### 8. 备份：首次真实同步前必须到位

- 第一次真实 Binance 账户同步前，必须具备 Postgres 备份脚本与一次 restore 演练记录。
- 开发夹具与 CI 数据可以随时丢弃；真实账本事件、成交、现金流、决策快照不可丢失。
- 备份至少覆盖 Postgres 数据库、迁移版本、`.env.example`、部署配置；真实 `.env` 由人单独保管，不进入备份仓库。

### 9. P1.5 影子采集器：尽早常驻，归 signal/facts

- OI / 多空比影子采集器从实施计划 P7 中拆出为 P1.5。
- 一旦 Postgres、worker、基础部署和可用 Binance 出口具备，就可常驻运行。
- 该采集器只访问公开 Binance 数据，无账号 key；不驱动策略，只积累历史；写入信号层事实库 `src/signal/facts/` 对应表。
- 采集范围初期只看 Binance 来源；非 Binance 数据源延后。

### 10. 验证门：P0 写入真实命令

- P0 脚手架落地时，必须把 `AGENTS.md` §4 的占位验证门替换为真实命令。
- Phase 1 默认验证门包含：lint、typecheck、测试、迁移检查；涉及前端时补充最小页面 smoke / e2e。
- 每个 agent 交付前必须跑同一套命令。命令不统一时，不允许并行实现跨层任务。

## 备选方案

- **Python FastAPI + Next.js 双栈**：不选。Phase 1 团队与 agent 协作成本会更高，契约和部署链路更分裂；Python 留作离线分析工具。
- **SQLite / DuckDB 作为主库**：不选。SQLite 不适合作为 web + worker 并发写入和长期真实账本库；DuckDB 更适合作为后续分析侧车，不承载圣数据。
- **Supabase / BaaS**：不选。项目自用、本地 key、出口网络和备份控制更重要；Phase 1 不需要外部 BaaS 的多用户能力。
- **Vercel / serverless cron 主运行**：不选。常驻采集、短保留端点、出口网络与恢复演练都要求可控的长期运行环境。
- **Redis / BullMQ / Kafka**：Phase 1 不选。Postgres 作业表足够支撑低频任务；引入消息系统会增加部署与恢复复杂度。
- **Drizzle 作为默认 ORM**：暂不选。Drizzle 更贴近 SQL，但 Prisma 的 schema、迁移和类型生成更适合 P0/P1 多 agent 统一落地；SQL 热点通过 raw SQL 处理。

## 影响

- 实施计划中的 P0 必须先落技术骨架、验证门、Postgres、worker 基线，再进入 P1 骨架闭环。
- ADR-0007 可基于 TypeScript DTO 与 Postgres schema 定义跨层契约。
- 账本、信号、策略三个目录在实现时不得绕过本 ADR 的运行模型另起数据库、调度器或密钥方案。
- 首次真实同步前，备份与恢复演练是硬门槛。
- OI / 多空比影子采集器成为 P1.5 命名交付物，owner 为 signal，数据落在 signal facts 模块。
