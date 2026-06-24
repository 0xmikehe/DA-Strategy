# P2-1 Mock, Local Import, and Cassette Design

## Goal

Allow local development to create and use ledger facts without local real account secrets or live Binance access.

P2-1 has three offline data paths:

1. A mock ledger service creates deterministic project-owned ledger packages for development and UI/replay testing.
2. Local import consumes redacted remote `ledger_export_package` files and submits facts with `source_mode = "remote_import"`.
3. Cassette fixtures preserve selected redacted packages for stable regression tests.

All three paths submit facts through `appendLedgerFacts()`.

## Mock Ledger Service

The mock ledger service is a project-owned data generator. It is not a Binance API compatibility server and must not expose `/api/binance/*` pass-through behavior.

Responsibilities:

- Generate deterministic ledger package data from named scenarios.
- Produce the same package envelope shape as remote export where practical.
- Support fixed timestamps and stable IDs so repeated runs are reproducible.
- Serve packages from a local command or local-only endpoint.
- Label generated facts with `source_mode = "mock"` when they are ingested.
- Include enough data to exercise replay, reconciliation, pending attribution, external trade entry, and ledger page states.

Initial scenario set:

- Empty account with healthy binding status.
- One deposit, one buy fill, fee in BNB, and matching balance snapshot.
- Buy then partial sell with realized lot movement.
- Transfer from master to strategy subaccount.
- Missing-event mismatch where reported balance is greater than computed balance.
- External wallet trade that enters pending attribution.
- Duplicate package/import attempt for idempotency testing.

Non-responsibilities:

- It does not call Binance.
- It does not sign requests.
- It does not generate secrets.
- It does not write ledger source tables directly.
- It does not pretend mock data is `remote_import` or `live`.

## Package Shape

Initial package sections shared by mock, remote import, and cassette paths:

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
- Mock packages submit facts with `source_mode = "mock"`.
- Remote packages submit facts with `source_mode = "remote_import"`.
- Cassette packages submit facts with `source_mode = "cassette"`.
- Local read models and pages must display the actual source mode: `mock`, `remote_import`, or `cassette`.

## Cassette Rules

Cassettes are redacted, stable packages promoted into deterministic test fixtures.

- They must not include real secrets.
- They must be safe for git if committed.
- They retain enough realistic shape to test parser, importer, idempotency, replay, and page source labels.

## Initial Verification

- Mock ledger service creates deterministic packages for the initial scenario set.
- Mock packages import successfully through `appendLedgerFacts()` with `source_mode = "mock"`.
- Valid package imports successfully through `appendLedgerFacts()`.
- Re-importing the same package produces no duplicate facts.
- Malformed package hash fails before ingestion.
- Local UI/read model source mode is `mock`, `remote_import`, or `cassette`, never `live`.
