# P2 Ledger Acceptance

P2 ledger is accepted only when the system can ingest, replay, reconcile, display, and safely audit account facts without breaking the project boundaries.

## Default Local Gate

The default gate remains offline:

```text
npm run verify
```

It must not require live Binance access, remote machine access, or real account secrets.

## Overall Acceptance

- All ledger fact mutations go through `appendLedgerFacts()`.
- Live sync, local import, cassette seed, external trade entry, attribution, and reversal paths are tested against the same ingest boundary.
- Mock ledger service output is deterministic, offline, and routed through the same import/ingest path.
- Ledger source facts are append-only; correction uses reversal or follow-up facts rather than silent update/delete.
- Every fact has source mode: `fixture`, `mock`, `cassette`, `remote_import`, or `live`.
- Mock data is visibly marked as `mock`, never as `remote_import` or `live`.
- Repeated import or sync of the same facts is idempotent.
- Local imported data is visibly marked as `remote_import`, never as `live`.
- Export packages include `schema_version`, `export_run_id`, `source_env_id`, `sync_run_id`, `exported_at`, `content_hash`, and redaction metadata.
- Exported packages do not contain API secrets, signed URLs, request headers, signatures, or full secret-bearing payloads.
- Live Binance calls are opt-in commands and run only where read-only account keys are configured.
- Reconciliation can compare replayed balances with reported balance snapshots and produce durable result records.
- Ledger page states make freshness, data source, reconciliation result, and pending attribution visible.

## Explicit Live Gates

These commands may require remote secrets and network access, so they are not part of the default local gate:

```text
npm run ledger:live-smoke
npm run ledger:export
npm run ledger:restore-smoke
```

The exact commands may be adjusted during implementation, but they must remain explicit opt-in gates.
