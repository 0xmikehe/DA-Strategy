# Research Index

This directory preserves evidence and external-source research used by PRDs, ADRs, and implementation plans.

Research documents are evidence sources, not implementation authority. Project decisions must be reflected in PRDs, ADRs, or implementation docs.

## Current Research

| File | Purpose | Consumed by |
| --- | --- | --- |
| `binance-account-api-research.md` | Binance account, trade, transfer, balance, key-health, and sync API evidence for ledger work | `docs/prd/账本层PRD_v0.1.md`, `docs/decisions/0003-ledger-account-model-and-sync-architecture.md`, P2 ledger implementation docs |
| `binance-market-data-api-research.md` | Binance public market-data evidence for signal work | `docs/prd/信号层PRD_v0.1.md`, signal facts implementation |

## Migration Rule

Keep evidence and source notes here. Extract project-specific implementation choices into `docs/implementation/` only after the relevant PRD/ADR boundary is clear.
