# P2-0 Ledger Ingest Kernel Design

## Goal

Create one ledger fact write boundary, tentatively named `appendLedgerFacts()`.

Every path that changes account facts submits normalized ledger ingest commands to this service. No collector, importer, controller, page action, fixture helper, or worker writes ledger source tables directly.

## Responsibilities

`appendLedgerFacts()` owns:

- Source mode validation.
- Actor and trigger metadata validation.
- Import/export metadata validation when source mode is `remote_import` or `cassette`.
- Idempotency keys across ledger source tables.
- Append-only semantics.
- Reversal semantics.
- Import batch metadata.
- Write summaries for downstream replay, reconciliation, and read model refresh.

It accepts commands for:

- Live Binance sync.
- Remote import packages.
- Fixture/cassette seed data.
- Manual external trade entry.
- Manual attribution.
- Reversals.

## Non-Responsibilities

`appendLedgerFacts()` does not:

- Call Binance.
- Export packages.
- Render pages.
- Calculate strategy actions.
- Evaluate market signals.

## Allowed Shape

```text
adapter/controller/worker/importer
  -> validate external/input shape
  -> normalize to ledger ingest command
  -> appendLedgerFacts()
  -> replay/reconciliation/read model
```

## Forbidden Shape

```text
adapter/controller/worker/importer
  -> direct insert/update into ledger source tables
```

## Required Source Modes

```ts
type LedgerDataSourceMode =
  | "fixture"
  | "mock"
  | "cassette"
  | "remote_import"
  | "live";
```

## Initial Verification

- Reject commands without source mode.
- Reject commands without idempotency key.
- Reject actor-required commands without actor metadata.
- Reject import-derived commands without import/export metadata.
- Prove fixture seed, remote import, live sync, external trade, attribution, and reversal paths call the same ingest boundary.
