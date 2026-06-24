# P2 Ledger Roadmap

## Purpose

P2 makes the ledger layer thick enough to support real account facts while keeping development repeatable and offline by default.

The core topology is:

```text
remote app/worker/postgres
  -> ledger export package
  -> local importer
  -> local replay/read models/pages
```

The core write rule is:

```text
adapter/controller/worker/importer
  -> validate input
  -> normalize to ledger ingest command
  -> appendLedgerFacts()
  -> replay/reconciliation/read model
```

No collector, importer, page action, or worker may write ledger source facts directly.

## Phase Breakdown

| Phase | Name | Goal | Main design |
| --- | --- | --- | --- |
| P2-0 | Ingest kernel | Define `appendLedgerFacts()` as the only ledger fact write boundary | `p2-0-ingest-kernel/design.md` |
| P2-1 | Local import and cassette | Import redacted ledger packages locally and promote stable packages into offline regression fixtures | `p2-1-local-import-cassette/design.md` |
| P2-2 | Remote exporter | Export normalized, redacted ledger packages from the remote runtime | `p2-2-remote-exporter/design.md` |
| P2-3 | Binance live sync | Call signed Binance USER_DATA endpoints remotely and submit normalized batches through the ingest kernel | `p2-3-binance-live-sync/design.md` |
| P2-4 | Replay and reconciliation | Compare replayed balances with reported snapshots and classify differences | `p2-4-replay-reconciliation/README.md` |
| P2-5 | Manual fallback writes | Route external trades, attribution, and reversals through the same ingest kernel | `p2-5-manual-fallback-writes/README.md` |
| P2-6 | Ledger page | Show source mode, freshness, reconciliation, pending attribution, and safe write actions | `p2-6-ledger-page/README.md` |
| P2-7 | Remote operations | Backup/restore, live smoke, deployment, logging, redaction, and alerts | `p2-7-remote-ops/README.md` |

## Dependency Order

1. P2-0 must land before any path writes ledger facts.
2. P2-1 should land before live sync so local development can validate realistic packages offline.
3. P2-2 can be built against fixture/cassette data before live sync exists.
4. P2-3 is opt-in and must not enter default local or CI gates.
5. P2-4 through P2-7 deepen correctness and operations after facts can flow through the ingest kernel.

## Non-Goals

- No automatic trading.
- No generic Binance API proxy.
- No local storage of real API secrets.
- No CI dependency on live Binance or the remote machine.
- No second ledger writer hidden in a controller, importer, worker, or page action.
