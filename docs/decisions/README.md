# 决策日志（ADR）索引

> 架构 / 契约 / 选型 / 重大取舍的**只追加**决策日志。规则见 `../../AGENTS.md` §3。
> 新增 ADR 时，编号递增、写完在下表追加一行。推翻旧决策：写新 ADR，并把旧 ADR 状态改为 `Superseded by ADR-NNNN`（不删除）。
> 模板见 [`0000-template.md`](0000-template.md)。

| 编号 | 标题 | 状态 | 涉及层 | 日期 |
| --- | --- | --- | --- | --- |
| [0001](0001-adopt-multi-agent-governance.md) | 采用 AGENTS.md 作为多 Agent 协作的单一权威规则 | Accepted | 全局 | 2026-06-13 |
| [0002](0002-visual-language-baseline.md) | 视觉语言基线 v0.3（Soft Midnight 设计契约） | Accepted | docs（约束三层页面） | 2026-06-13 |
| [0003](0003-ledger-account-model-and-sync-architecture.md) | 账本层账户模型与同步架构 | Accepted | ledger（影响 signal/strategy） | 2026-06-15 |
| [0004](0004-signal-layer-methodology-baseline.md) | 信号层方法论基线（注册表 · 卡片同源 · 三态生命周期 · AI 边界） | Accepted | signal（影响 strategy/账本快照） | 2026-06-15 |
