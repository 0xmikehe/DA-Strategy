# P2-7 Remote Operations Design

## Goal

Make the remote ledger runtime operable, recoverable, and auditable.

P2-7 is the operational closure of P2. It does not add a new source of account facts. It makes sure the already-defined paths can run on a long-lived remote machine with explicit deployment, live smoke, backup, restore rehearsal, logging redaction, alerting, and runbooks.

## Prerequisites

P2-7 depends on:

- P2-0 ingest kernel and the single ledger fact write boundary.
- P2-1 mock/import/cassette package paths.
- P2-2 remote exporter.
- P2-3 explicit live sync commands.
- P2-4 replay/reconciliation.
- P2-5 manual fallback write services.
- P2-6 ledger page read/action boundaries.
- ADR-0010 remote collector plus local import topology.

## Operating Model

The remote runtime is the official account-fact runtime:

```text
remote app / worker / postgres
  -> live sync through read-only credentials
  -> appendLedgerFacts()
  -> replay / reconciliation
  -> backup / export / alert
  -> local import when a package is pulled
```

The local runtime remains the default development runtime:

```text
local app / postgres
  -> fixture / mock / cassette / remote_import
  -> npm run verify
```

Default local and CI gates remain offline. Live smoke, backup, restore, and remote export are explicit operator actions.

## Components

### Remote Runtime Profile

The supported remote profile is intentionally small:

- Node app process.
- Ledger worker process.
- Postgres.
- durable filesystem location for exports and backups.
- operator SSH access or equivalent private channel.
- environment-managed read-only account secrets.

P2-7 should document process names, expected ports, required environment variables, data directories, and service restart sequence.

### Environment and Secret Handling

Remote secrets are runtime configuration, not project data.

Rules:

- API key values and secrets stay in the remote environment or secret manager.
- `.env` files are not committed.
- backups do not include plaintext secrets.
- exports do not include secrets or signed request material.
- logs include `key_ref`, account scope, endpoint group, and safe reason codes only.
- strategy and signal layers never receive key material.

The ops config check validates presence of required variables without printing their values.

### Deployment and Migration Runbook

Deployment is a controlled sequence:

```text
fetch release
  -> install/build
  -> run prisma validation/status
  -> run migrations
  -> restart app and worker
  -> run health checks
  -> run optional live smoke
```

The runbook must make rollback explicit:

- do not roll back by editing ledger facts.
- if a deploy breaks code but DB migration succeeded, restore code to previous release and run read-only health checks.
- DB restore is a recovery operation, not a routine rollback.

### Job Supervision

The worker must expose safe health information:

- process alive.
- last tick time.
- last successful ledger sync time.
- last failed job by type.
- queue depth or pending job count where available.
- current backoff state for live sync.

Job supervision is operational state. It does not write ledger source facts except through the existing P2-0/P2-3/P2-5 paths.

### Backup

Backup protects source truth and unreconstructable manual/operator data.

Must include:

- ledger source fact tables.
- account balance snapshots.
- decision snapshots.
- attribution records.
- external trades.
- reversals.
- account binding audits.
- sync cursors.
- export metadata.
- reconciliation results, even if rebuildable, for audit convenience.

May exclude:

- caches.
- generated build output.
- local development cassettes already committed.
- plaintext secrets.

Backup output must include:

- backup ID.
- created time.
- source environment ID.
- database migration version.
- content checksum.
- table counts.
- redaction/secret scan result.

### Restore Rehearsal

Restore rehearsal proves the backup is useful.

Initial rehearsal target:

```text
backup file
  -> isolated local or remote scratch database
  -> prisma migration/status validation
  -> replay/reconciliation smoke
  -> export smoke if needed
  -> restore report
```

Restore rehearsal must not point at the production database. It must use a scratch database URL and fail if the target looks like the official remote DB.

### Live Smoke

Live smoke is an explicit opt-in command. It verifies the remote path without doing a broad sync.

Checks:

- remote environment config is present.
- app/worker health endpoints are reachable where available.
- Postgres is reachable.
- migrations are current.
- read-only key health is safe.
- Binance server time or a lightweight read-only account check works.
- no unsafe permission is detected.
- no source fact table is modified unless the command is explicitly promoted to a sync.

Live smoke output must be safe to paste into an issue or PR.

### Export and Local Pull

P2-7 operationalizes the P2-2/P2-1 package flow:

```text
remote export command
  -> redacted package
  -> checksum
  -> private transfer
  -> local import
  -> local replay/reconciliation
```

The runbook should include the exact operator flow and verification commands. It must not introduce a generic Binance proxy or public export endpoint.

### Logging and Redaction

All remote logs go through a redaction layer before operator-visible output.

Never log:

- API key.
- API secret.
- signature.
- signed query string.
- request headers.
- full signed URL.
- plaintext `.env` values.
- full deposit/withdrawal address unless explicitly reviewed and masked.

Safe log fields:

- job ID.
- endpoint group.
- account scope.
- key reference.
- source mode.
- package/export IDs.
- row counts.
- error code.
- safe reason code.

### Alerting

Initial alerts are low-noise and ledger-focused:

- worker stopped ticking.
- no successful ledger sync beyond freshness threshold.
- key health `BLOCK`.
- repeated live sync failure.
- reconciliation status not `MATCHED` beyond threshold/time budget.
- backup failed.
- restore rehearsal failed or overdue.
- export failed redaction/hash validation.

Alerts must avoid sensitive account values. Ledger page can show detailed account-sensitive state after authentication, but push/notification channels should use safe summaries only.

## Command Surface

Initial explicit commands:

```text
npm run ledger:ops:check
npm run ledger:live-smoke
npm run ledger:backup
npm run ledger:restore-smoke
npm run ledger:export
```

Optional deployment wrapper:

```text
npm run ops:deploy
```

These commands may evolve during implementation, but they must remain explicit operator commands and must not be part of `npm run verify`.

## Data Flow

```text
operator deploy
  -> build/migrate/restart
  -> ops check
  -> optional live smoke
  -> worker runs scheduled sync
  -> appendLedgerFacts()
  -> replay/reconciliation
  -> backup/export/alert
```

```text
operator restore-smoke
  -> read backup
  -> create/use scratch database
  -> restore
  -> validate migrations
  -> run replay/reconciliation smoke
  -> produce safe restore report
```

## Failure Semantics

- Config check failure blocks live sync and backup commands that need the missing config.
- Unsafe key health blocks live sync and live smoke.
- Backup failure produces an alert and does not delete older backups.
- Restore-smoke target validation failure aborts before touching any database.
- Redaction failure aborts export or log publication.
- Alert failure is recorded but does not block fact ingest.
- Deploy failure must leave a clear runbook state: not started, build failed, migration failed, restart failed, or post-deploy health failed.

## Boundaries

- P2-7 does not call Binance except through P2-3 live smoke/sync services.
- P2-7 does not write ledger source facts directly.
- P2-7 does not add a transparent Binance API proxy.
- P2-7 does not put secrets in backups, exports, logs, UI, or notifications.
- P2-7 does not make strategy decisions.
- P2-7 does not make local or CI verification depend on the remote machine.

## Verification

- `npm run verify` remains offline.
- Ops config check redacts secret values.
- Live smoke is explicit opt-in and safe by default.
- Backup command produces checksum, table counts, and metadata.
- Backup secret scan fails if secret-like fields appear.
- Restore smoke refuses production DB targets.
- Restore smoke can rebuild a scratch database and run replay/reconciliation checks.
- Logs redact known secret-bearing fields.
- Alerts include safe reason codes and no sensitive balances or secret material.
- Remote export plus local import flow remains package-based, not proxy-based.
