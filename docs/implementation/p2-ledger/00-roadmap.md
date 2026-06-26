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

P2 uses three record classes:

| Class | Examples | Writer rule |
| --- | --- | --- |
| Account source facts | `exchange_trade_fill`, `exchange_order`, `capital_flow_event`, `external_trade`, `attribution_record`, `ledger_reversal`, `account_balance_snapshot` | Only `appendLedgerFacts()` writes these rows. |
| Derived audit/results | `reconciliation_result`, replay/run summaries | Owning derived service may append these rows. They must not write source facts or advance sync cursors. |
| Control-plane state | queued jobs, export runs, backup runs, ops alerts, credential health, account labels | Owning service writes its own operational state. It calls `appendLedgerFacts()` only when account source facts or source-fact cursors must change. |

When a document says "ledger fact write boundary", it means the first class: account source facts plus the cursor advancement that must be committed atomically with a successful source-fact batch.

## Phase Breakdown

| Phase | Name | Goal | Main design |
| --- | --- | --- | --- |
| P2-0 | Ingest kernel | Define `appendLedgerFacts()` as the only ledger fact write boundary | `p2-0-ingest-kernel/design.md` |
| P2-1 | Mock, local import, and cassette | Generate deterministic mock ledger packages, import redacted remote packages locally, and promote stable packages into offline regression fixtures | `p2-1-local-import-cassette/design.md` |
| P2-2 | Remote exporter | Export normalized, redacted ledger packages from the remote runtime | `p2-2-remote-exporter/design.md` |
| P2-3 | Account binding and Binance sync | P2-3a owns offline account binding/credential-health baseline; P2-3b owns opt-in signed Binance USER_DATA sync and ingest-kernel submission | `p2-3-binance-live-sync/design.md` |
| P2-4 | Replay and reconciliation | Compare replayed balances with reported snapshots and classify differences | `p2-4-replay-reconciliation/design.md` |
| P2-5 | Manual fallback writes | Route external trades, attribution, and reversals through the same ingest kernel | `p2-5-manual-fallback-writes/design.md` |
| P2-6 | Ledger page | Show source mode, freshness, reconciliation, pending attribution, and safe write actions | `p2-6-ledger-page/design.md` |
| P2-7 | Remote operations | Backup/restore, live smoke, deployment, logging, redaction, and alerts | `p2-7-remote-ops/design.md` |

## Dependency Order

1. P2-0 must land before any path writes ledger facts.
2. P2-1 should land before live sync so local development can generate deterministic mock ledger facts and validate realistic packages offline.
3. P2-2 can be built against fixture/cassette data before live sync exists.
4. P2-3a is offline/default-gate work: it owns the `exchange_account`, `api_credential`, `api_key_health_check`, and `account_binding_audit` baseline if those models do not already exist, plus mocked/local binding management and automatic-attribution lookup.
5. P2-3b is opt-in live work: signed Binance calls, live key health checks, endpoint workers, and remote sync. P2-3b must not enter default local or CI gates.
6. P2-4/P2-6 may consume binding and health summaries after P2-3a has defined them; they do not need P2-3b live sync to render offline/mock/imported states.
7. P2-4 through P2-7 deepen correctness and operations after facts can flow through the ingest kernel.

## Non-Goals

- No automatic trading.
- No generic Binance API proxy.
- No local storage of real API secrets.
- No CI dependency on live Binance or the remote machine.
- No second ledger writer hidden in a controller, importer, worker, or page action.
