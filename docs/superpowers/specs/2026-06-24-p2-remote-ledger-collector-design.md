# P2 Remote Ledger Collector + Local Import Kit Design

## 1. Purpose

P2 needs to move the ledger layer from fixture proof into real account facts while keeping local development repeatable and safe.

The design is:

```text
remote app/worker/postgres -> ledger export package -> local importer -> local replay/read models/pages
```

The remote machine is the formal runtime for live collection. The local machine remains the development surface. Local development can use fixture, mock, cassette, or imported remote data without holding real account secrets or depending on live network access.

## 2. Design Principles

1. **No transparent Binance proxy**
   The project will not expose a generic `/api/binance/*` pass-through. Remote APIs export project-owned ledger facts, not Binance API compatibility responses.

2. **Ledger facts are the boundary**
   Remote output is normalized ledger-domain data: events, fills, flows, balance snapshots, reconciliation results, and health summaries.

3. **Single ledger ingest service**
   All ledger fact mutations go through one service, tentatively named `appendLedgerFacts()`. Collectors, importers, fixtures, manual controllers, attribution flows, and reversal flows may submit commands or packages, but they do not write source fact tables directly.

4. **Local verification stays offline**
   `npm run verify` must not depend on live Binance or the remote machine. Live checks use explicit commands.

5. **Secrets stay remote**
   Real API key and secret values live only on the remote runtime or future secret store. Local imports never require them.

6. **Every imported fact is traceable**
   Export packages carry `export_run_id`, `source_env_id`, `sync_run_id`, `schema_version`, and `content_hash`.

7. **Source mode is visible**
   UI and read models must distinguish `fixture`, `mock`, `cassette`, `remote_import`, and `live`.

## 3. Runtime Modes

| Mode | Runs where | Purpose | External network | Secrets |
| --- | --- | --- | --- | --- |
| `fixture` | local / CI | deterministic P1/P2 skeleton | no | no |
| `mock` | local / CI | API errors, retries, cursor edges | no | no |
| `cassette` | local / CI | high-fidelity regression from redacted exports | no | no |
| `remote_import` | local dev | develop against realistic ledger facts | pull project export only | no |
| `live` | remote | real account sync and reconciliation | yes | yes |

`live` is never the default local mode.

## 4. Components

### 4.1 Remote Ledger Collector

Owner: `src/ledger/`

Responsibilities:

- Resolve active account bindings and `key_ref`.
- Run key health checks before account sync.
- Call Binance signed `USER_DATA` endpoints from the remote runtime.
- Apply weight budgeting, retry/backoff, and cursor windows.
- Normalize responses into append-only ledger facts.
- Submit normalized facts to `appendLedgerFacts()`.
- Submit `account_balance_snapshot` data through the same ingest batch.
- Run reconciliation after each sync.
- Record `job_run`, `sync_cursor`, and sync health.

The collector does not write fact tables directly. It plans remote sync work, calls external APIs, normalizes responses, and hands a batch to the ledger ingest service.

### 4.2 Ledger Ingest Service

Owner: `src/ledger/ingest/`

This is the only component allowed to mutate ledger source facts.

Responsibilities:

- Accept normalized ledger commands from live sync, remote import, fixture/cassette seed, manual external trade entry, attribution, and reversal flows.
- Validate source mode, schema version, actor, import/export metadata, and required trace IDs.
- Enforce append-only semantics.
- Apply idempotency keys consistently across `ledger_event`, `exchange_trade_fill`, `exchange_order`, `capital_flow_event`, `external_trade`, `account_balance_snapshot`, `reconciliation_result`, and future attribution/reversal tables.
- Store import batch metadata for `remote_import` and cassette-derived data.
- Reject ambiguous writes where source mode, idempotency key, or actor is missing.
- Return a write summary for downstream reconciliation/read model refresh.

Non-responsibilities:

- It does not call Binance.
- It does not render pages.
- It does not export packages.
- It does not calculate strategy actions.

Every write path must be shaped like:

```text
adapter/controller/worker
  -> validate external/input shape
  -> normalize to ledger ingest command
  -> appendLedgerFacts()
  -> replay/reconciliation/read model
```

Forbidden shape:

```text
adapter/controller/worker
  -> direct insert/update into ledger source tables
```

### 4.3 Remote Ledger Exporter

Owner: `src/ledger/export/`

Responsibilities:

- Select an export scope by `sync_run_id`, time window, or latest successful sync.
- Redact sensitive fields.
- Build a `ledger_export_package`.
- Compute package hash.
- Persist export metadata.
- Serve the package through a private internal endpoint or write it as a file for SSH copy.

Preferred access paths:

1. `ledger:export` on remote writes a package file.
2. Local `ledger:pull-remote` downloads through SSH or private tunnel.
3. Optional internal endpoint: `GET /api/internal/ledger/exports/:export_run_id`.

The endpoint is project-owned. It is not a Binance proxy.

### 4.4 Local Ledger Importer

Owner: `src/ledger/import/`

Responsibilities:

- Load a package from file or private endpoint.
- Validate `schema_version`, `content_hash`, and required sections.
- Reject packages from unknown `source_env_id` unless explicitly allowed.
- Submit package facts to `appendLedgerFacts()` with `source_mode = "remote_import"`.
- Record import metadata.
- Mark local read models as `remote_import`.

The importer may run against local Postgres only. It must not require Binance API key or secret values, and it must not write ledger source tables except through the ingest service.

### 4.5 Mock and Cassette Toolkit

Owner: `tests/fixtures`, `src/fixtures`, and ledger test helpers.

Responsibilities:

- Mock Binance client behavior for retry, blocked access, duplicate rows, malformed payloads, clock drift, and cursor windows.
- Convert selected redacted export packages into stable cassette fixtures.
- Keep regression tests deterministic and offline.

Mock tests prove behavior. Cassette tests prove realistic shape.

## 5. Ledger Export Package Contract

Initial package shape:

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

Rules:

- `manifest.schema_version` is required.
- All timestamps are ISO strings with offset.
- All financial quantities are decimal strings.
- IDs and idempotency keys must be stable across repeated exports.
- `content_hash` covers all package sections except transport metadata.
- Unknown required fields fail import.
- Unknown optional fields are preserved only if the schema marks them as extension-safe.

## 6. Redaction Rules

Never export:

- API key, secret, signature, signed query string, request header, or full request URL with signed parameters.
- Full deposit/withdrawal addresses.
- Secret-bearing `.env` values.

Default export redacts:

- Sub-account emails where not needed for matching.
- Long transaction IDs to prefix/suffix summaries, unless full IDs are needed for idempotency.
- Raw Binance response fields that are not part of the ledger contract.

Remote DB may retain full raw payload for audit. Local default packages should use `raw_payload_redacted`.

## 7. Data Flow

### 7.1 Remote Live Sync

```text
job_run(ledger_sync)
  -> key health check
  -> endpoint window planning
  -> Binance signed requests
  -> normalize
  -> appendLedgerFacts(source_mode = live)
  -> balance snapshot
  -> replay
  -> reconciliation
  -> sync health
```

### 7.2 Export

```text
remote DB
  -> select scope
  -> redact
  -> package
  -> hash
  -> file or internal endpoint
```

### 7.3 Local Import

```text
download package
  -> verify manifest/hash/schema
  -> import metadata
  -> appendLedgerFacts(source_mode = remote_import)
  -> replay locally
  -> page/read model source = remote_import
```

## 8. UI and Read Model Requirements

Ledger read models need a `data_source_mode` field:

```ts
type LedgerDataSourceMode =
  | "fixture"
  | "mock"
  | "cassette"
  | "remote_import"
  | "live";
```

UI requirements:

- Ledger page shows data mode near sync/reconciliation status.
- Imported data shows the `source_env_id`, `exported_at`, and `sync_run_id`.
- Live remote UI can show `live`; local imported UI must show `remote_import`.
- No page displays raw secrets or signed request data.

## 9. Security and Access

Recommended transport:

1. SSH file transfer for first implementation.
2. Tailscale or SSH tunnel for private endpoint later.

Rules:

- No public export endpoint.
- No remote endpoint that accepts arbitrary Binance paths.
- Export endpoint requires explicit export ID or latest successful export.
- Export audit log records actor, time, scope, and hash.
- Local import rejects packages with failed hash validation.

## 10. Verification Strategy

Default local gate:

```text
npm run verify
```

Must remain offline.

Additional P2 tests:

- Ingest service rejects any command without source mode, actor/import metadata, or idempotency key.
- Live sync, remote import, cassette seed, and manual external trade tests all assert they call the same ingest boundary.
- Package schema validation accepts valid exports and rejects malformed packages.
- Importer is idempotent for repeated package imports.
- Mock Binance client covers 429, blocked response, clock drift, duplicate page, and partial endpoint failure.
- Redaction test confirms no secret-like fields appear in exported packages.
- Read model test confirms data mode is visible and not mislabelled.

Remote explicit gates:

```text
npm run ledger:live-smoke
npm run ledger:export
npm run ledger:restore-smoke
```

These commands are opt-in and may require remote secrets and live network.

## 11. Rollout Plan

### Step 1: Contract Freeze

- Add ADR-0010.
- Add the `appendLedgerFacts()` interface and source mode contract.
- Add TypeScript schema for `LedgerExportPackage`.
- Add redaction rules and import metadata schema.

### Step 2: Local Import First

- Build importer against fixture/cassette package.
- Prove idempotent imports.
- Prove importer writes only through `appendLedgerFacts()`.
- Add page/read model data source mode.

### Step 3: Remote Exporter

- Build exporter from DB rows.
- Add package hash.
- Add redaction.
- Add file-based export.

### Step 4: Remote Collector

- Implement signed client, key health, cursors, endpoint windows, and normalization.
- Keep live commands opt-in.
- Submit live batches through `appendLedgerFacts()`.

### Step 5: Reconciliation and Cassettes

- Export real redacted package.
- Import locally.
- Promote selected package to cassette for regression.

## 12. Non-Goals

- No automatic trading.
- No generic Binance API proxy.
- No local storage of real API secrets.
- No requirement that CI reaches Binance.
- No public multi-user account system.
- No full Binance API mock compatibility layer.
- No second ledger writer hidden in a controller, importer, worker, or page action.

## 13. Open Decisions for Implementation Planning

These are implementation-level choices, not architecture blockers:

1. Whether first export transport is only file/SSH or also an internal endpoint.
2. Exact table names for export/import metadata.
3. Whether full raw payload stays remote-only forever or can be exported with a stricter one-off mode.
4. Whether remote runs the full Next app immediately or starts with `worker + postgres` and adds app access later.
