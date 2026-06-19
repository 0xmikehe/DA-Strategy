# AGENTS.md — 多 Agent 协作权威规则

> 本文件是本项目所有 AI 编码助手（Claude Code / Cursor / Copilot / Codex 及任何临时 agent）和人类协作者共同遵守的**唯一权威规则**。
> 其它工具的指令文件（`CLAUDE.md`、`.cursor/rules/*`、`.github/copilot-instructions.md`）只是指针，内容以本文件为准。
> 临时派任务给某个 agent 时，请在任务开头加一句："动手前先读 `AGENTS.md` 并严格遵守。"

---

## 0. 项目是什么（背景，30 秒读完）

**数字资产投资操作系统**：面向加密**现货**、**中长期配置**的个人投资研究/策略/执行/复盘工作台。
核心信条：**可复盘、可证伪、可淘汰**——系统中不存在不被复盘检验的模块（含 AI）。

权威文档：
- 立项书（做什么/不做什么/为什么）：`docs/prd/数字资产投资项目立项计划书_v0.2.md`
- 总 PRD（系统怎么组织）：`docs/prd/数字资产投资操作系统_总PRD_v0.1.md`
- 两者冲突时**以立项书的边界为准**。
- 视觉契约（前端 token / 组件 / 状态词表，**做前端必读**）：`design/数字资产投资操作系统_视觉说明.html`；决策依据见 `docs/decisions/0002-visual-language-baseline.md`。

三层架构（也是 agent 的天然分工边界）：

| 层 | 管什么 | 验收标准 | 目录约定 |
| --- | --- | --- | --- |
| 事实层（账本） | 发生了什么（只追加、不可变） | 账对不对 | `src/ledger/` |
| 判断层（信号） | 市场有哪些客观信号（可证伪、只读） | 判断准不准 | `src/signal/` |
| 决策层（策略） | 基于判断该做什么（可复盘、可淘汰） | 决策好不好 | `src/strategy/` |

层间契约（**不可绕过**）：决策层只消费「启用态信号集 + 快照 ID」，永不直接读原始行情；市场事实库归信号层 `src/signal/facts/`；判断层对账户事实库零依赖。

边界红线（第一阶段绝不触碰）：不碰合约/杠杆/做空/期权、不做自动下单、**只用只读 API（无交易、无提现权限）**。

---

## 1. 行为标准（人和 agent 都 follow）

按重要性排序。**任何一条与具体任务冲突时，先停下来问人，不要自作主张。**

1. **Git 是唯一协调层。** 不同 agent 之间不共享记忆，磁盘 + git 是唯一共享大脑。所有改动必须可归因到「某 agent + 某任务」。禁止改写历史（`push --force` / `rebase` 已合入 main 的提交）。

2. **先冻结契约，再并行开工。** schema / 接口 / 模块边界先写进文档定死，再分头实现。契约未定不得并行。新增或修改跨层接口，必须先记一条 ADR（见 §3）。

3. **一个文件/模块同一时间只有一个 owner。** 按层切（账本/信号/策略），不同 agent 改不同目录，**不得两个 agent 同时改同一批文件**。

4. **每次交付必须可独立验证。** 交活前 typecheck / lint / 测试必须全绿。"完成"的定义必须是**机器可检验**的，不是"我觉得写完了"。

5. **只追加的决策日志。** 任何架构/契约/取舍决策，写一条 ADR 到 `docs/decisions/`。**不得静默推翻另一个 agent 的决策**——要改先写新 ADR 说明理由，旧 ADR 标记为 Superseded，不删除。（呼应本项目"事实只追加"哲学。）

6. **Read before write，入乡随俗。** 动手前先读相关现有代码与文档，**匹配既有风格/命名/注释密度**，不要把自己那套强加进来。

7. **不许 scope creep。** 只做被分配的那一片。发现别的问题就**记下来上报**，不要顺手改。

8. **人是唯一的集成者。** AI agent 只**提 PR / 提交到任务分支**，由人 review 后合并。agent 不得自动合并彼此的产出，不得直接提交到 `main`。

9. **密钥永不入库。** API key、`.env`、密钥文件一律不进 git（见 `.gitignore`）。站内动态 / 未来推送 / 日志不得打印账户敏感信息。

---

## 2. Git 工作流约定

- **分支命名**：`<layer>/<task>`，例如 `ledger/binance-sync`、`signal/state-v0`、`docs/prd-account-layer`。
- **永远从最新 `main` 切分支**，不在 `main` 上直接改。
- **小步提交**：一个提交只做一件事，提交信息写清「做了什么 + 为什么」。
- **提交信息格式**：首行 `<scope>: <做了什么>`（祈使句），空行后写为什么 / 关联 ADR。
- **合并前自检**：lint / typecheck / 测试全绿；diff 自己先读一遍。
- 由 AI 生成的提交，在提交信息结尾保留生成者署名行，便于归因。

## 3. 决策日志（ADR）用法

- 位置：`docs/decisions/NNNN-<短标题>.md`，编号递增、只增不删。
- 何时写：定/改跨层契约、选型、重大取舍、推翻先前决策时。
- 模板见 `docs/decisions/0000-template.md`。
- 推翻旧决策：写新 ADR，并把旧 ADR 状态改为 `Superseded by NNNN`。

## 4. 验证门（"完成"的机器可检验定义）

> Phase 1 / P0 起，所有 agent 使用同一套本地验证门。首次运行前先执行 `npm install`，从 `.env.example` 创建本机 `.env`（真实 key 不入库），并执行 `npm run db:up` 启动本地 Postgres。

```
# local Postgres
npm run db:up

# lint
npm run lint

# typecheck
npm run typecheck

# Prisma schema validation
npm run prisma:validate

# Prisma migration status
npm run db:status

# unit / contract / integration / worker tests
npm run test

# DB smoke
npm run db:smoke

# worker smoke
npm run worker:smoke

# aggregate gate
npm run verify
```

- 涉及前端 e2e 时再运行：`npm run test:e2e`。
- 真实 Binance 网络 / 账号测试不属于默认本地或 CI 验证门；必须由人明确触发，并使用只读 key。
- 交付前至少保证 `npm run verify` 全绿；若修改前端页面，补跑 `npm run build`。
- 若修改 `prisma/schema.prisma`，必须提交对应 `prisma/migrations/*/migration.sql`，并确认 `npm run db:status` 全绿。

---

## 5. 给临时 agent 派活的模板

```
任务：<一句话目标>
所属层 / 目录：<ledger | signal | strategy | docs>，只改这里
分支：<layer>/<task>，从最新 main 切
约束：先读 AGENTS.md 全文并遵守；不碰其它目录；交付前跑通验证门；
      有跨层接口改动先写 ADR；只读 API、密钥不入库；
      涉及前端/视觉时，先读视觉契约 `design/数字资产投资操作系统_视觉说明.html` 与 ADR-0002，沿用其 token 与组件，不另起一套。
完成标准：<机器可检验的条件>
```
