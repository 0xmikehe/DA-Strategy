# P2-1 Mock, Local Import, and Cassette Design

## Goal

Allow local development to create, import, and replay ledger facts without local real account secrets, live Binance access, or a remote machine dependency.

P2-1 has three offline data paths:

1. A mock ledger service creates deterministic project-owned ledger packages for development, replay, reconciliation, and UI testing.
2. Local import consumes redacted remote `ledger_export_package` files and submits facts with `source_mode = "remote_import"`.
3. Cassette fixtures preserve selected redacted packages as stable regression inputs.

All three paths normalize package content into `LedgerIngestCommand` and submit facts through `appendLedgerFacts()`.

## Prerequisites

P2-1 depends on P2-0:

- `appendLedgerFacts()` exists and owns source fact writes.
- Ingest command types, source modes, origin/trigger metadata, package metadata, idempotency, and conflict semantics are implemented.
- P2-0 tests already prove mock, cassette, remote import, fixture, live, manual, attribution, and reversal paths can call the same ingest boundary.

P2-1 must not create a second write path.

## Components

### Ledger Package Contract

`ledger_export_package` is the shared envelope for mock packages, remote exports, and cassettes. It is a project-owned domain package, not a Binance API clone.

Initial sections:

```json
{
  "manifest": {
    "schema_version": "ledger.export.v1",
    "package_id": "pkg_...",
    "package_kind": "mock",
    "export_run_id": "lexp_...",
    "source_env_id": "mock-local",
    "sync_run_id": "job_...",
    "scenario_id": "deposit_buy_fee",
    "cassette_id": "cassette_p2_1_deposit_buy_fee",
    "produced_at": "2026-06-25T00:00:00.000Z",
    "content_hash": "sha256:...",
    "redaction_level": "none"
  },
  "exchange_accounts": [],
  "api_key_health_summaries": [],
  "exchange_trade_fills": [],
  "exchange_orders": [],
  "capital_flow_events": [],
  "external_trades": [],
  "attribution_records": [],
  "reversals": [],
  "account_balance_snapshots": [],
  "reconciliation_results": [],
  "sync_cursor_summaries": [],
  "raw_payload_redacted": []
}
```

`manifest.package_kind` is one of:

- `mock`
- `remote_export`
- `cassette`

Section semantics:

| Section | Class | Import behavior |
| --- | --- | --- |
| `exchange_trade_fills`, `exchange_orders`, `capital_flow_events`, `external_trades`, `attribution_records`, `reversals`, `account_balance_snapshots` | account source facts | Map to `LedgerFactCommand` and call `appendLedgerFacts()`. |
| `exchange_accounts`, `api_key_health_summaries` | read-only summaries | Validate/redact and expose to local read models where supported; never create credentials or key material locally. |
| `reconciliation_results` | derived audit/results | Import only after P2-4 owns a local result writer/import path. Until then, validate the section shape and report `ignored_until_phase = "P2-4"` in the import summary. |
| `sync_cursor_summaries` | control-plane cursor summaries | Do not advance local cursors by default. Convert to `cursor_advancements` only in explicit trusted restore mode. |
| `raw_payload_redacted` | evidence/debug payload | Validate redaction and hash coverage; never map to source facts. |

All top-level sections are arrays and should be present even when empty. Unknown required sections fail validation; unknown extension-safe optional sections may be preserved in package metadata but must not be silently treated as account truth.

Manifest-to-ingest metadata mapping:

| Package manifest field | P2-0 metadata field | Notes |
| --- | --- | --- |
| `schema_version` | `package_metadata.schema_version`, `import_metadata.schema_version` | Same package schema version. |
| `package_id` | `package_metadata.package_id` | Stable package identity. |
| `package_kind` | import source-mode selection | `mock` -> `mock`, `remote_export` -> `remote_import`, `cassette` -> `cassette`. |
| `export_run_id` | `import_metadata.export_run_id` | Required for `remote_export`; deterministic synthetic value is allowed for mock/cassette. |
| `source_env_id` | `package_metadata.source_env_id`, `import_metadata.source_env_id` | Never a secret. |
| `sync_run_id` | `package_metadata.sync_run_id`, `import_metadata.sync_run_id` | Optional. |
| `produced_at` | `package_metadata.produced_at`, `import_metadata.exported_at` | `exported_at` is the ingest metadata name for remote import provenance. |
| `content_hash` | `package_metadata.content_hash`, `import_metadata.content_hash` | Verified before ingestion. |
| `redaction_level` | `package_metadata.redaction_level`, `import_metadata.redaction_level` | Required for remote imports. |

Hash rule:

- `content_hash` is computed from canonical package JSON with `manifest.content_hash` temporarily omitted or set to an empty string.
- Any import command must verify the hash before calling `appendLedgerFacts()`.
- A hash mismatch fails before ingestion.

### Mock Ledger Service

The mock ledger service is a deterministic package generator.

Responsibilities:

- Generate package files from named scenarios.
- Use fixed timestamps, package IDs, account IDs, event IDs, and fact idempotency keys.
- Produce the same package envelope shape as remote export where practical.
- Label generated facts with `source_mode = "mock"` at ingest time.
- Preserve fact origin as `{ kind: "mock_scenario", scenario_id }`.
- Include data needed to exercise replay, reconciliation, pending attribution, external trade entry, duplicate import behavior, and ledger page state labels.

Non-responsibilities:

- It does not call Binance.
- It does not sign requests.
- It does not generate secrets.
- It does not write ledger source tables directly.
- It does not expose `/api/binance/*`.
- It does not pretend mock data is `remote_import` or `live`.

Initial scenario set:

| Scenario | Purpose |
| --- | --- |
| `empty_healthy_account` | Empty account and healthy binding/key summaries. |
| `deposit_buy_fee` | Deposit, buy fill, BNB fee, and matching balance snapshot. |
| `partial_sell_lot` | Buy then partial sell to feed future lot/replay behavior. |
| `master_to_sub_transfer` | Master to strategy subaccount funding flow. |
| `missing_event_mismatch` | Reported balance greater than computed balance for reconciliation testing. |
| `external_wallet_pending_attribution` | External trade that enters pending attribution. |
| `duplicate_import` | Same package/facts imported repeatedly for idempotency testing. |
| `mixed_origin_package` | Package containing both generated exchange-like facts and manual attribution/reversal-like facts to prove fact-level origin preservation. |

### Local Importer

The local importer validates a package file and maps each section into P2-0 ingest commands.

Responsibilities:

- Parse package JSON from disk.
- Validate `manifest.schema_version`, `package_kind`, timestamp shape, decimal strings, and required sections.
- Verify `manifest.content_hash` before ingestion.
- Reject unknown required fields.
- Accept unknown optional fields only if the schema marks them extension-safe.
- Convert package facts into `LedgerIngestCommand`.
- Set `source_mode = "remote_import"` for remote packages.
- Set `source_mode = "mock"` for mock packages.
- Set `source_mode = "cassette"` for cassette packages.
- Preserve fact-level origin/trigger metadata when package sections contain mixed origins.
- Return a safe import summary without secrets or raw signed payloads.

The importer must not mutate the package, rewrite IDs, or repair malformed package content silently.

### Cassette Fixtures

Cassettes are redacted, stable packages promoted into deterministic test fixtures.

Rules:

- Cassettes are safe to commit.
- Cassettes must not include API keys, API secrets, signatures, signed URLs, request headers, or full secret-bearing payloads.
- Cassettes retain enough realistic shape to test package parsing, hash verification, import idempotency, origin preservation, replay, reconciliation, and UI source labels.
- A cassette is immutable after promotion. Updates create a new cassette ID.

## Data Flow

Mock package:

```text
scenario id
  -> mock ledger package generator
  -> ledger_export_package JSON
  -> package validator/hash checker
  -> package-to-ingest mapper
  -> appendLedgerFacts(source_mode = "mock")
```

Remote package:

```text
remote ledger_export_package file
  -> local importer
  -> hash/redaction/schema validation
  -> package-to-ingest mapper
  -> appendLedgerFacts(source_mode = "remote_import")
```

Cassette:

```text
redacted package selected for regression
  -> cassette fixture file
  -> package validator/hash checker
  -> package-to-ingest mapper
  -> appendLedgerFacts(source_mode = "cassette")
```

## Import Mapping Rules

- Package `exchange_trade_fills` become `LedgerFactCommand.kind = "exchange_trade_fill"`.
- Package `exchange_orders` become `LedgerFactCommand.kind = "exchange_order"`.
- Package `capital_flow_events` become `LedgerFactCommand.kind = "capital_flow_event"`.
- Package `external_trades` become `LedgerFactCommand.kind = "external_trade"`.
- Package `attribution_records` become `LedgerFactCommand.kind = "attribution_record"`.
- Package `reversals` become `LedgerFactCommand.kind = "reversal"`.
- Package `account_balance_snapshots` become `LedgerFactCommand.kind = "account_balance_snapshot"`.
- Package `exchange_accounts` and `api_key_health_summaries` do not become source facts. They are read-only summaries for local page state and operator diagnostics.
- Package `reconciliation_results` do not call `appendLedgerFacts()`. Before P2-4 import support exists, they are validated and ignored with an explicit import summary warning.
- Package `sync_cursor_summaries` may become `cursor_advancements` only when the package source is trusted and the import mode explicitly allows cursor restore.
- Package `raw_payload_redacted` is never imported into source fact tables.
- Decimal values remain strings.
- Timestamps remain UTC ISO strings with offset.
- Raw payload sections are optional and must already be redacted.

## Failure Semantics

- Invalid JSON fails before ingestion.
- Unsupported `schema_version` fails before ingestion.
- Hash mismatch fails before ingestion.
- Secret-like fields fail before ingestion.
- Missing required package sections fail before ingestion.
- Duplicate package import is idempotent through P2-0 batch/fact keys.
- Same idempotency key with changed content fails as conflict.
- Partial package import must not commit. The importer submits one package-level batch unless a later design explicitly adds chunked import with resumable batch metadata.

## CLI Shape

Initial local commands:

```text
npm run ledger:mock-package -- --scenario deposit_buy_fee --out tmp/ledger/mock/deposit_buy_fee.json
npm run ledger:import-package -- --file tmp/ledger/mock/deposit_buy_fee.json
npm run ledger:cassette:promote -- --file tmp/ledger/remote/latest.json --cassette-id cassette_p2_1_latest
```

These command names may be refined during implementation, but they must remain local/offline and must not call live Binance.

## Verification

- Mock package generation is deterministic for each scenario.
- Mock packages import through `appendLedgerFacts()` with `source_mode = "mock"`.
- Remote package fixture imports through `appendLedgerFacts()` with `source_mode = "remote_import"`.
- Cassette imports through `appendLedgerFacts()` with `source_mode = "cassette"`.
- Re-importing the same package produces no duplicate facts.
- Malformed package hash fails before ingestion.
- Secret-like package fields fail before ingestion.
- Mixed-origin packages preserve per-fact origin metadata.
- Local read models and pages can distinguish `mock`, `remote_import`, and `cassette`, never `live`.
