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
| [0005](0005-strategy-layer-methodology-baseline.md) | 策略层方法论基线（策略为第一公民 · 信号→动作映射归策略 · 版本化复盘 · AI 仅润色） | Accepted | strategy（消费 signal/ledger） | 2026-06-16 |
| [0006](0006-phase1-technical-baseline.md) | Phase 1 技术栈与运行基线 | Accepted | 全局（ledger / signal / strategy / docs） | 2026-06-19 |
| [0007](0007-phase1-cross-layer-contracts.md) | Phase 1 跨层契约基线 | Accepted | 全局（ledger / signal / strategy） | 2026-06-19 |
| [0008](0008-p1-snapshot-content-storage.md) | P1 快照内容存储路径 | Accepted | ledger / signal / strategy / frontend | 2026-06-19 |
| [0009](0009-p15-market-data-shadow-collector.md) | P1.5 市场数据影子采集器 | Accepted | signal / frontend / docs | 2026-06-20 |
| [0010](0010-p2-remote-ledger-collector-and-local-import.md) | P2 远端受控账本采集与本地导入拓扑 | Accepted | 全局（ledger / signal / strategy / docs） | 2026-06-24 |
