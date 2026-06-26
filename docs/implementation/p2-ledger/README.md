# P2 Ledger Implementation

This directory is the canonical home for P2 ledger implementation documents.

P2 turns the ledger layer from fixture-backed proof into a thicker account-fact system: controlled ingestion, local imports, remote exports, live Binance sync, replay/reconciliation, manual fallbacks, ledger UI, and remote operations.

## Authority Chain

Read in this order:

1. `AGENTS.md`
2. `docs/prd/账本层PRD_v0.1.md`
3. `docs/decisions/0003-ledger-account-model-and-sync-architecture.md`
4. `docs/decisions/0010-p2-remote-ledger-collector-and-local-import.md`
5. This directory

This directory does not supersede PRDs or ADRs. It explains how accepted decisions will be implemented and verified.

`docs/implementation/phase1/phase1-master-plan.md` keeps a high-level Phase 1 milestone view. When it mentions "P2: ledger thickening", this directory is the canonical execution breakdown for that milestone. Future agents should update the phase-specific documents here first, then keep the master plan as a pointer instead of creating a second P2 task list.

## Documents

- `00-roadmap.md` - P2 ledger phase breakdown and dependency order.
- `00-acceptance.md` - overall P2 ledger acceptance gates.
- `p2-0-ingest-kernel/design.md` - single ledger ingest service design.
- `p2-0-ingest-kernel/plan.md` - P2-0 implementation plan.
- `p2-1-local-import-cassette/design.md` - mock ledger service, local package import, and cassette regression design.
- `p2-1-local-import-cassette/plan.md` - P2-1 implementation plan.
- `p2-2-remote-exporter/design.md` - remote ledger export package and redaction design.
- `p2-2-remote-exporter/plan.md` - P2-2 implementation plan.
- `p2-3-binance-live-sync/design.md` - account binding baseline plus opt-in live Binance account sync design.
- `p2-3-binance-live-sync/plan.md` - P2-3 implementation plan.
- `p2-4-replay-reconciliation/design.md` - replay and reconciliation design.
- `p2-4-replay-reconciliation/plan.md` - P2-4 implementation plan.
- `p2-5-manual-fallback-writes/design.md` - manual fallback write design.
- `p2-5-manual-fallback-writes/plan.md` - P2-5 implementation plan.
- `p2-6-ledger-page/design.md` - ledger page design.
- `p2-6-ledger-page/plan.md` - P2-6 implementation plan.
- `p2-7-remote-ops/design.md` - remote operations design.
- `p2-7-remote-ops/plan.md` - P2-7 implementation plan.

Implementation plans should be added as `plan.md` inside each phase directory only after that phase design is approved.
