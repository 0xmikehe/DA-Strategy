# Project Documentation Index

This directory is the canonical home for project documentation. Durable explanatory content should live under the functional directories below.

## Document Classes

| Directory | Purpose | Authority |
| --- | --- | --- |
| `prd/` | Product intent, scope, layer responsibilities, and user-facing requirements | Authoritative for what the system should do, bounded by the project charter |
| `decisions/` | ADRs for architecture, contracts, major tradeoffs, and superseding decisions | Append-only decision authority |
| `research/` | Evidence, API research, source constraints, and external facts used by PRDs/ADRs | Evidence source, not implementation authority |
| `api/` | Human-readable contract companions and examples | Companion to ADRs and source types |
| `business/` | Phase acceptance criteria and business validation language | Acceptance reference |
| `signals/` | Signal dossiers, signal cards, thresholds, lifecycle notes, and evidence summaries | Signal-level product/design reference |
| `strategies/` | Concrete strategy dossiers, decision maps, rule versions, and strategy-specific notes | Strategy-level product/design reference |
| `implementation/` | Roadmaps, designs, execution plans, and verification notes for implementation work | Canonical implementation planning home |

## Reading Order

For a new agent or human collaborator:

1. Read `AGENTS.md` in the repository root.
2. Read the project charter in `prd/数字资产投资项目立项计划书_v0.2.md`.
3. Read the system PRD in `prd/数字资产投资操作系统_总PRD_v0.1.md`.
4. Read the relevant layer PRD under `prd/`.
5. Read any ADR referenced by that PRD under `decisions/`.
6. Read the relevant implementation roadmap or phase directory under `implementation/`.

## Migration Rule

When moving existing explanatory documents:

1. Create the new canonical document under `docs/`.
2. Preserve or absorb the useful content there.
3. Update references to the new canonical location.
4. Run a reference scan with `rg` before deleting the old path.

ADRs are never merged or deleted during cleanup. Superseding a decision requires a new ADR.
