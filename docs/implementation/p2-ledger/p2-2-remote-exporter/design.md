# P2-2 Remote Exporter Design

## Goal

Export normalized, redacted ledger facts from the remote runtime as project-owned `ledger_export_package` files for local development, replay, reconciliation, and regression testing.

The exporter is not a Binance proxy. It does not expose arbitrary Binance paths, signed request data, or raw secret-bearing payloads.

## Prerequisites

P2-2 depends on:

- P2-0 ingest source tables and metadata.
- P2-1 package schema, package hash logic, local importer, and cassette rules.
- A remote runtime with database access to normalized ledger facts.

It can be developed against mock/cassette data before P2-3 live sync exists.

## Components

### Export Scope Resolver

The exporter supports explicit scopes:

| Scope | Meaning |
| --- | --- |
| `latest_successful_sync` | Export facts touched by the latest successful ledger sync job. |
| `sync_run_id` | Export facts associated with one sync run. |
| `time_window` | Export facts with `occurred_at` inside `[start, end]`. |
| `all_since` | Export facts after a given high-watermark. |
| `fixture_scope` | Export selected mock/cassette-like facts for local package tests. |

Every export records the selected scope in metadata. Broad exports should be explicit; there is no accidental full-database dump.

### Package Builder

The package builder reads normalized ledger tables and creates the P2-1 package envelope:

- `manifest`
- `exchange_accounts`
- `api_key_health_summaries`
- `exchange_trade_fills`
- `exchange_orders`
- `capital_flow_events`
- `external_trades`
- `attribution_records`
- `reversals`
- `account_balance_snapshots`
- `reconciliation_results`
- `sync_cursor_summaries`
- optional `raw_payload_redacted`

Package rows preserve source mode, origin, trigger, idempotency keys, natural keys, occurred times, payload hashes, and redacted payloads.

Only the account source fact sections are source truth. `exchange_accounts`, `api_key_health_summaries`, `reconciliation_results`, `sync_cursor_summaries`, and `raw_payload_redacted` are exported as read-only summaries, derived audit state, cursor summaries, or redacted evidence. Their presence in a package must not imply that the local importer should call `appendLedgerFacts()` for them.

### Redactor

The redactor runs before hash calculation.

Never export:

- API key.
- API secret.
- Signature.
- Signed query string.
- Request headers.
- Full request URL with signed parameters.
- Secret-bearing `.env` values.
- Full deposit/withdrawal addresses unless explicitly reviewed.
- Full raw signed payloads.

Default redaction may keep:

- Exchange account IDs and local account labels.
- Strategy IDs and strategy versions.
- Public symbols and assets.
- Numeric quantities as decimal strings.
- Redacted tx IDs or address fingerprints if needed for audit.
- `raw_payload_redacted` with secret-like fields removed or masked.

### Export Metadata Store

The remote runtime stores export metadata even when transport is file-based.

Minimum export metadata:

- `export_run_id`
- `schema_version`
- `source_env_id`
- `actor`
- `scope`
- `row_counts`
- `redaction_level`
- `content_hash`
- `package_path` or internal package reference
- `created_at`

The metadata store is operational/audit state. It is not a second ledger fact writer.

### Transport

Preferred transport order:

1. Remote command writes a package file on the remote machine.
2. Local command pulls the file through SSH or another private channel.
3. Optional later endpoint: `GET /api/internal/ledger/exports/:export_run_id`.

No public export endpoint is allowed. Any endpoint version must be internal/private and require an operator-controlled channel.

## Data Flow

```text
operator export command
  -> resolve export scope
  -> read normalized ledger facts
  -> redact payloads
  -> build ledger_export_package
  -> compute content_hash
  -> persist export metadata
  -> write package file
  -> local import via P2-1
```

## Package Manifest

Remote packages use:

```json
{
  "schema_version": "ledger.export.v1",
  "package_id": "lexp_...",
  "package_kind": "remote_export",
  "export_run_id": "lexp_...",
  "source_env_id": "remote-prod-1",
  "sync_run_id": "job_...",
  "produced_at": "2026-06-25T00:00:00.000Z",
  "content_hash": "sha256:...",
  "redaction_level": "default"
}
```

`content_hash` follows P2-1 hash rules.

## Failure Semantics

- Empty scope may produce a valid empty package only when `--allow-empty` is explicit.
- Redaction failure aborts export.
- Hash calculation failure aborts export.
- File write failure records failed export metadata and does not publish a package reference.
- Internal endpoint, if added later, must not generate packages on unauthenticated request.
- Export retry with the same scope may create a new `export_run_id`; package content hash should stay stable if source rows are unchanged.

## Boundary Rules

- Exporter reads ledger source facts; it does not call Binance.
- Exporter does not write source fact tables.
- Exporter does not transform imported rows into local facts. Local import remains P2-1 responsibility.
- Exporter does not make local imported data look live.
- Exporter does not expose secrets, signed request material, or arbitrary raw payload dumps.

## CLI Shape

Initial remote command:

```text
npm run ledger:export -- --scope latest_successful_sync --out tmp/ledger/exports/latest.json
```

Initial local pull/import flow:

```text
scp remote:/path/to/latest.json tmp/ledger/remote/latest.json
npm run ledger:import-package -- --file tmp/ledger/remote/latest.json
```

The exact command names may be adjusted during implementation, but export and import remain explicit operator actions.

## Verification

- Export hash is stable for the same package content.
- Export package validates against the P2-1 package schema.
- Redaction test confirms secret-like fields are absent.
- Export metadata records actor, export time, scope, row counts, hash, and source environment.
- Local import rejects a tampered exported package.
- Exporter does not contain a `/api/binance/*` route or generic Binance proxy behavior.
- Exporter cannot write ledger source fact tables.
