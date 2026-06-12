# ADR-0001: 采用 AGENTS.md 作为多 Agent 协作的单一权威规则

- 状态：Accepted
- 日期：2026-06-13
- 决策者：hashmike + Claude Code
- 涉及层：全局

## 背景

本项目会由多个 AI 编码助手（Claude Code / Cursor / Copilot 及临时 agent）与人协作完成。不同工具之间不共享记忆，磁盘 + git 是唯一共享大脑。各工具读取的指令文件名不同，存在规则分裂、互相覆盖、并行改同一文件等风险。

## 决策

- 在根目录维护**唯一权威规则** `AGENTS.md`（含项目背景、三层架构边界、9 条行为标准、Git 工作流、ADR 用法、验证门）。
- 各工具的指令文件做成**指针**，内容以 AGENTS.md 为准：
  - `CLAUDE.md` 用 `@AGENTS.md` 导入；
  - `.cursor/rules/agents.mdc`（alwaysApply）；
  - `.github/copilot-instructions.md`。
- 临时 agent 在派活 prompt 里显式要求"先读 AGENTS.md 并遵守"。
- 用 git 做协调层：分支 `<layer>/<task>`、小步提交、人做唯一集成者。
- 架构/契约决策以**只追加**的 ADR 记录在 `docs/decisions/`。

## 备选方案

- 各工具各自维护一份规则：被否，必然分裂、互相打架。
- 全部直接读 AGENTS.md 不要指针：被否，各工具原生支持不统一且在变，指针文件更确定。

## 影响

- 后续任何跨层接口/选型/取舍决策都新增 ADR；推翻旧决策写新 ADR 并把旧的标 Superseded。
- 技术栈确定后，需回填 `AGENTS.md` §4 验证门的真实命令。
