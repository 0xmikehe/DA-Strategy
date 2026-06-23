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

3. **Local verification stays offline**
   `npm run verify` must not depend on live Binance or the remote machine. Live checks use explicit commands.

4. **Secrets stay remote**
   Real API key and secret values live only on the remote runtime or future secret store. Local imports never require them.

5. **Every imported fact is traceable**
   Export packages carry `export_run_id`, `source_env_id`, `sync_run_id`, `schema_version`, and `content_hash`.

6. **Source mode is visible**
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
- Write `account_balance_snapshot`.
- Run reconciliation after each sync.
- Record `job_run`, `sync_cursor`, and sync health.

The collector writes to the remote Postgres database. It does not expose raw signed requests to local development.

### 4.2 Remote Ledger Exporter

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

### 4.3 Local Ledger Importer

Owner: `src/ledger/import/`

Responsibilities:

- Load a package from file or private endpoint.
- Validate `schema_version`, `content_hash`, and required sections.
- Reject packages from unknown `source_env_id` unless explicitly allowed.
- Upsert/import facts idempotently.
- Record import metadata.
- Mark local read models as `remote_import`.

The importer may run against local Postgres only. It must not require Binance API key or secret values.

### 4.4 Mock and Cassette Toolkit

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
  -> append/upsert ledger facts
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
  -> idempotent upsert
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
- Add TypeScript schema for `LedgerExportPackage`.
- Add redaction rules and import metadata schema.

### Step 2: Local Import First

- Build importer against fixture/cassette package.
- Prove idempotent imports.
- Add page/read model data source mode.

### Step 3: Remote Exporter

- Build exporter from DB rows.
- Add package hash.
- Add redaction.
- Add file-based export.

### Step 4: Remote Collector

- Implement signed client, key health, cursors, endpoint windows, and normalization.
- Keep live commands opt-in.
- Write remote DB facts.

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

## 13. Open Decisions for Implementation Planning

These are implementation-level choices, not architecture blockers:

1. Whether first export transport is only file/SSH or also an internal endpoint.
2. Exact table names for export/import metadata.
3. Whether full raw payload stays remote-only forever or can be exported with a stricter one-off mode.
4. Whether remote runs the full Next app immediately or starts with `worker + postgres` and adds app access later.
