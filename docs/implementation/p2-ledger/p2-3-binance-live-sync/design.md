# P2-3 Binance Live Sync Design

## Goal

Run real Binance account sync on the remote runtime and submit normalized ledger facts through `appendLedgerFacts()`.

Live sync is never the default local mode.

## Responsibilities

The live collector:

- Resolves active account bindings and `key_ref`.
- Runs key health checks before account sync.
- Calls signed Binance USER_DATA endpoints from the remote runtime.
- Applies weight budgeting, retry/backoff, and cursor windows.
- Normalizes responses into ledger ingest commands.
- Submits all facts to `appendLedgerFacts()` with `source_mode = "live"`.
- Submits balance snapshots through the same ingest batch.
- Triggers replay and reconciliation after each sync.
- Records job runs, cursors, and sync health.

## Boundaries

The collector does not write ledger source facts directly. It also does not expose raw Binance responses to local development.

Strategy and signal layers do not call signed account APIs. Account-sync credentials belong to the ledger layer.

## Initial Verification

- Live smoke is explicit opt-in.
- Key health check blocks unsafe or invalid credentials before account sync.
- Duplicate pages or repeated sync windows do not duplicate facts.
- Partial endpoint failures produce durable job/run health state.
- All successful normalized facts enter through `appendLedgerFacts()`.
