# ADR-0008: P1 快照内容存储路径

- 状态：Accepted
- 日期：2026-06-19
- 决策者：hashmike + Codex
- 涉及层：ledger / signal / strategy / frontend

## 背景

ADR-0007 已经把决策时点快照拆成两部分：

- `DecisionSnapshotContainer` 归 ledger，负责 `snapshot_id`、存储、取回和不可变性。
- `SignalSnapshotContent` 归 signal，负责记录当时系统看到的市场输入、启用态信号集和数据健康状态。

ADR-0007 允许 `content_ref` 或 `content_json` 两种容器字段；P0 的 Prisma baseline 也保留了这两个字段。这对长期演进是有价值的，但进入 P1 以后，如果不先收口，业务实现会出现双路径分歧：

- ledger 仓储需要同时判断 `content_ref` / `content_json`。
- signal 快照内容可能被重复写到 JSON 和另一张内容表。
- frontend / BFF 可能直接暴露原始 `content_json`。
- `content_hash` 的计算对象不清楚，削弱快照不可变性。

P1 的目标是 fixture 行走骨架，不是归档系统或对象存储系统。因此需要先固定一条简单、可验证、可迁移的快照内容存储路径。

## 决策

### 1. P1 以 `decision_snapshot.content_json` 作为唯一 active content path

P1 写入的 sealed decision snapshot 必须满足：

```text
decision_snapshot.content_json = SignalSnapshotContent
decision_snapshot.content_ref  = null
decision_snapshot.content_hash = sha256(canonical_json(content_json))
```

`content_json` 在 P1 直接承载 signal 定义的 `SignalSnapshotContent` JSON，不再另建 `signal_snapshot_content` 表。

### 2. `content_ref` 保留但不写入

`content_ref` 是后续外部归档、对象存储、不可变 blob 或大体量快照内容的预留字段。

P1 不写 `content_ref`，业务代码不得把 `content_ref` 作为正常读取路径。未来若启用 `content_ref`，必须新增 ADR 或修订本 ADR，明确：

- 内容写入位置。
- hash 计算对象。
- 读取 fallback 规则。
- 归档失败时的事务语义。
- 旧 `content_json` 快照的兼容策略。

### 3. `content_hash` 对 canonical JSON 计算

P1 的 `content_hash` 是快照内容的防篡改指纹，不是 `snapshot_id`、不是外部地址，也不是数据库行 hash。

计算规则：

1. 对 `content_json` 递归按 key 排序。
2. 不保留多余空白。
3. 使用 UTF-8 字节序列。
4. 使用 `sha256` 输出 hex string。

同一份快照内容在不同运行中必须得到同一 `content_hash`。

### 4. 读取路径通过仓储函数收口

业务代码不得在各处直接判断 `content_json` / `content_ref`。P1 实现时应提供一个单一读取入口，例如：

```ts
resolveDecisionSnapshotContent(snapshotId)
```

该入口在 P1 只读取 `content_json`，并用 zod 校验为 `SignalSnapshotContent` 后再交给上层。

### 5. 前端和 BFF 不暴露原始 `content_json`

P1 页面只通过 BFF / read model 消费解析后的摘要，例如：

- `SignalSnapshotRef`
- snapshot summary
- active signal rows
- data health
- input summary

前端不得直接展示或依赖 `content_json` 原始结构，也不得展示 `raw_payload`。

### 6. DB 层要约束 sealed snapshot

P1 migration 应补充数据库 check：

```sql
CHECK (immutability_state <> 'sealed' OR content_json IS NOT NULL)
```

这保证 P1 的 sealed snapshot 不会出现只有 hash 但无内容的不可复盘状态。

## 备选方案

### 方案 A：P1 同时支持 `content_json` 与 `content_ref`

不选。双路径会让仓储、测试、BFF 和页面都提前承担归档系统复杂度；P1 没有对象存储、归档失败处理和恢复演练，支持双路径只会制造不一致。

### 方案 B：单独建立 `signal_snapshot_content` 表

不选。P1 的快照内容已经可以完整放入 `decision_snapshot.content_json`。再建内容表会造成双写与漂移风险。后续 P3 如果需要按输入引用、信号 ID、数据健康状态做高频查询，可再新增投影表或索引表。

### 方案 C：只存 `content_ref`，内容放文件或对象存储

不选。P1 是本地 fixture 行走骨架，使用外部内容存储会增加运行环境、备份和恢复复杂度，也不利于本地测试稳定性。

### 方案 D：不计算 `content_hash`

不选。快照是可复盘和防篡改的核心证据。即使 P1 数据来自 fixture，也必须从第一版开始建立 hash 纪律。

## 影响

- P1.1 migration 不应新增 `signal_snapshot_content` 表。
- P1.1 migration 应保留 `decision_snapshot.content_ref` nullable，但不把它作为 P1 正常写入路径。
- P1.1 migration 应补充 sealed snapshot 的 `content_json IS NOT NULL` check。
- P1.2 应新增 `SignalSnapshotContent` 的 zod schema，并在读取 `content_json` 时校验。
- P1.3 / P1.4 的 BFF 与页面只能消费解析后的 summary，不直接暴露 `content_json`。
- `docs/api/p1-er.md` 是 P1.1 业务表和关系的 review 基线；若 ER 与本 ADR 冲突，以本 ADR 为准。
