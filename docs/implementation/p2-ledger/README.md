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

## Documents

- `00-roadmap.md` - P2 ledger phase breakdown and dependency order.
- `00-acceptance.md` - overall P2 ledger acceptance gates.
- `p2-0-ingest-kernel/design.md` - single ledger ingest service design.
- `p2-1-local-import-cassette/design.md` - local package import and cassette regression design.
- `p2-2-remote-exporter/design.md` - remote ledger export package and redaction design.
- `p2-3-binance-live-sync/design.md` - live Binance account sync design.
- `p2-4-replay-reconciliation/README.md` - future replay/reconciliation phase home.
- `p2-5-manual-fallback-writes/README.md` - future manual fallback write phase home.
- `p2-6-ledger-page/README.md` - future ledger page phase home.
- `p2-7-remote-ops/README.md` - future remote operations phase home.

Implementation plans should be added as `plan.md` inside each phase directory only after that phase design is approved.
