# Copilot 指令 — 指针

本项目所有协作规则、架构边界、行为标准与 Git 工作流，**以根目录 `AGENTS.md` 为唯一权威**。

请在生成任何代码或修改前，遵循 `AGENTS.md`，尤其是：
- 一个文件/模块同一时间只有一个 owner，不跨目录乱改；
- 分支命名 `<layer>/<task>`，从最新 main 切，不直接改 main；
- 跨层接口改动先写 ADR（`docs/decisions/`）；
- 只读 API、密钥永不入库；交付前跑通验证门。
