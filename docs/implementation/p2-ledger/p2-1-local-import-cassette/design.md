# P2-1 Local Import and Cassette Design

## Goal

Allow local development to use realistic remote ledger facts without local real account secrets or live Binance access.

Local import consumes a project-owned `ledger_export_package`, validates it, and submits facts to `appendLedgerFacts()` with `source_mode = "remote_import"`.

## Package Shape

Initial package sections:

```json
{
  "manifest": {
    "schema_version": "ledger.export.v1",
    "export_run_id": "lexp_...",
    "source_env_id": "remote-prod-1",
    "sync_run_id": "job_...",
    "exported_at": "2026-06-24T00:00:00.000Z",
    "content_hash": "sha256:...",
    "redaction_level": "default"
  },
  "exchange_accounts": [],
  "api_key_health_summaries": [],
  "ledger_events": [],
  "exchange_trade_fills": [],
  "exchange_orders": [],
  "capital_flow_events": [],
  "account_balance_snapshots": [],
  "reconciliation_results": [],
  "sync_cursor_summaries": [],
  "raw_payload_redacted": []
}
```

## Import Rules

- `manifest.schema_version` is required.
- `content_hash` must validate before any ingest command is submitted.
- Unknown required fields fail import.
- Unknown optional fields are accepted only when marked extension-safe by the schema.
- Decimal values are strings.
- Timestamps are ISO strings with offset.
- Repeat import of the same package is idempotent.
- Local read models and pages must display imported data as `remote_import`.

## Cassette Rules

Cassettes are redacted, stable packages promoted into deterministic test fixtures.

- They must not include real secrets.
- They must be safe for git if committed.
- They retain enough realistic shape to test parser, importer, idempotency, replay, and page source labels.

## Initial Verification

- Valid package imports successfully through `appendLedgerFacts()`.
- Re-importing the same package produces no duplicate facts.
- Malformed package hash fails before ingestion.
- Local UI/read model source mode is `remote_import` or `cassette`, never `live`.
