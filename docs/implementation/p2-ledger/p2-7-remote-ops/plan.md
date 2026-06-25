# P2-7 Remote Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remote ledger operations layer: config checks, live smoke, backup, restore rehearsal, deployment runbook, logging redaction, and safe alerts.

**Architecture:** P2-7 adds an ops module under `src/ledger/ops/` plus runbook documentation. Operator commands are explicit and separate from `npm run verify`; remote-only commands validate config and redact output before touching live services. No ops command writes ledger source facts except by delegating to existing P2-3/P2-5 services.

**Tech Stack:** TypeScript, Node CLI via `tsx`, Prisma, Postgres CLI tools for dump/restore where available, Zod, Vitest, existing local verification gate, optional shell wrappers only when they call checked TypeScript entrypoints.

---

## Required Reading

- `AGENTS.md`
- `docs/implementation/p2-ledger/p2-7-remote-ops/design.md`
- `docs/implementation/p2-ledger/00-acceptance.md`
- `docs/decisions/0010-p2-remote-ledger-collector-and-local-import.md`
- `docs/implementation/p2-ledger/p2-2-remote-exporter/design.md`
- `docs/implementation/p2-ledger/p2-3-binance-live-sync/design.md`
- `docs/implementation/p2-ledger/p2-4-replay-reconciliation/design.md`
- `docs/prd/账本层PRD_v0.1.md` section 7

## File Structure

- Create `src/ledger/ops/types.ts`.
- Create `src/ledger/ops/config.ts`.
- Create `src/ledger/ops/redaction.ts`.
- Create `src/ledger/ops/logger.ts`.
- Create `src/ledger/ops/health.ts`.
- Create `src/ledger/ops/live-smoke.ts`.
- Create `src/ledger/ops/backup.ts`.
- Create `src/ledger/ops/restore-smoke.ts`.
- Create `src/ledger/ops/alerts.ts`.
- Create `src/ledger/ops/cli.ts`.
- Create `docs/implementation/p2-ledger/p2-7-remote-ops/runbook.md`.
- Modify `package.json`: add explicit ops scripts.
- Create `tests/ledger/ops/config.test.ts`.
- Create `tests/ledger/ops/redaction.test.ts`.
- Create `tests/ledger/ops/health.test.ts`.
- Create `tests/ledger/ops/live-smoke.test.ts`.
- Create `tests/ledger/ops/backup.test.ts`.
- Create `tests/ledger/ops/restore-smoke.test.ts`.
- Create `tests/ledger/ops/alerts.test.ts`.
- Create `tests/ledger/ops/boundary.test.ts`.

## Task 1: Ops Types and Config Check

**Files:**
- Create: `src/ledger/ops/types.ts`
- Create: `src/ledger/ops/config.ts`
- Create: `tests/ledger/ops/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Test:

- required remote env vars are reported by name when missing.
- secret values are never included in config check output.
- local mode can pass without live Binance secrets.
- remote mode requires database URL, source env ID, backup directory, export directory, and key refs.
- unsafe restore target patterns can be identified.

Run:

```bash
npm run test -- tests/ledger/ops/config.test.ts
```

Expected: FAIL because `src/ledger/ops/config.ts` does not exist.

- [ ] **Step 2: Implement config contracts**

Define:

- `LedgerOpsMode = "local" | "remote" | "restore_scratch"`.
- `LedgerOpsCheckResult`.
- `LedgerOpsConfig`.
- `loadLedgerOpsConfig(env)`.
- `checkLedgerOpsConfig(config)`.

The check returns safe issue objects such as:

```ts
{
  severity: "block",
  code: "missing_env",
  field: "LEDGER_REMOTE_SOURCE_ENV_ID",
  message: "Missing required remote environment variable"
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/ops/config.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 2: Redaction and Safe Logger

**Files:**
- Create: `src/ledger/ops/redaction.ts`
- Create: `src/ledger/ops/logger.ts`
- Create: `tests/ledger/ops/redaction.test.ts`

- [ ] **Step 1: Write failing redaction tests**

Test:

- API key, secret, signature, signed URL, request headers, and `.env` values are masked.
- nested objects are recursively redacted.
- safe fields such as job ID, endpoint group, account scope, key ref, export ID, and row counts remain visible.
- redaction returns stable JSON for logs.

Run:

```bash
npm run test -- tests/ledger/ops/redaction.test.ts
```

Expected: FAIL because redaction module does not exist.

- [ ] **Step 2: Implement redaction helpers**

Expose:

```ts
redactLedgerOpsValue(value)
redactLedgerOpsText(text)
createLedgerOpsLogger(writer)
```

Use deny-listed keys:

- `apiKey`
- `apiSecret`
- `signature`
- `headers`
- `signedUrl`
- `authorization`
- `cookie`
- `queryString`
- `env`

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/ops/redaction.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 3: Remote Health Check

**Files:**
- Create: `src/ledger/ops/health.ts`
- Create: `tests/ledger/ops/health.test.ts`

- [ ] **Step 1: Write failing health tests**

Test:

- health check reports database reachability.
- health check reports migration status as current/stale/unknown.
- worker heartbeat can be represented as ok/stale/missing.
- last ledger sync age can be represented without exposing balances.
- failed job summary uses safe reason codes.

Run:

```bash
npm run test -- tests/ledger/ops/health.test.ts
```

Expected: FAIL until health module exists.

- [ ] **Step 2: Implement health service**

Expose:

```ts
getLedgerOpsHealth(deps, config): Promise<LedgerOpsHealthReport>
```

Keep dependencies injectable:

- DB ping.
- migration status reader.
- worker heartbeat reader.
- job summary reader.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/ops/health.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 4: Explicit Live Smoke

**Files:**
- Create: `src/ledger/ops/live-smoke.ts`
- Create: `tests/ledger/ops/live-smoke.test.ts`

- [ ] **Step 1: Write failing live smoke tests**

Test:

- live smoke is blocked when config check has blocking issues.
- unsafe key health blocks live smoke.
- live smoke can call a mocked P2-3 key health/server-time check.
- live smoke output does not include secret-bearing request details.
- live smoke does not call `appendLedgerFacts()` or write source facts.

Run:

```bash
npm run test -- tests/ledger/ops/live-smoke.test.ts
```

Expected: FAIL until live smoke exists.

- [ ] **Step 2: Implement live smoke service**

Expose:

```ts
runLedgerLiveSmoke(deps, config): Promise<LedgerLiveSmokeReport>
```

Use injected P2-3 services. Keep the command read-only unless a later explicit sync command is invoked.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/ops/live-smoke.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 5: Backup Command

**Files:**
- Create: `src/ledger/ops/backup.ts`
- Create: `tests/ledger/ops/backup.test.ts`

- [ ] **Step 1: Write failing backup tests**

Test:

- backup plan includes source facts, snapshots, attribution, external trades, reversals, account binding audit, sync cursors, export metadata, and reconciliation results.
- backup metadata includes backup ID, created time, source env ID, migration version, checksum, table counts, and secret scan result.
- backup output path is inside the configured backup directory.
- backup failure does not delete older backups.
- secret scan fails when secret-like keys appear in backup metadata.

Run:

```bash
npm run test -- tests/ledger/ops/backup.test.ts
```

Expected: FAIL until backup module exists.

- [ ] **Step 2: Implement backup planner**

Expose:

```ts
createLedgerBackupPlan(config, now): LedgerBackupPlan
validateLedgerBackupArtifact(artifact): LedgerBackupValidationResult
```

Keep actual `pg_dump` execution behind an injectable runner so unit tests do not require shelling out.

- [ ] **Step 3: Implement backup runner adapter**

The runner may call `pg_dump` in implementation, but tests should use a fake runner.

The command must produce:

- dump file.
- metadata JSON.
- checksum.
- safe summary.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/ops/backup.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 6: Restore Smoke

**Files:**
- Create: `src/ledger/ops/restore-smoke.ts`
- Create: `tests/ledger/ops/restore-smoke.test.ts`

- [ ] **Step 1: Write failing restore tests**

Test:

- restore smoke refuses production DB URLs.
- restore smoke requires `restore_scratch` mode.
- restore smoke validates backup checksum before restore.
- restore smoke runs migration/status validation after restore.
- restore smoke can call mocked replay/reconciliation smoke.
- restore report contains no secrets.

Run:

```bash
npm run test -- tests/ledger/ops/restore-smoke.test.ts
```

Expected: FAIL until restore module exists.

- [ ] **Step 2: Implement target guard**

Expose:

```ts
assertSafeRestoreTarget(databaseUrl, config)
```

Reject:

- configured production remote DB URL.
- missing scratch marker.
- localhost production alias if configured as official runtime.

- [ ] **Step 3: Implement restore smoke runner**

Expose:

```ts
runLedgerRestoreSmoke(deps, config, backupRef)
```

Use injectable runners for `pg_restore`, migration status, and replay/reconciliation smoke.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/ops/restore-smoke.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 7: Alerts

**Files:**
- Create: `src/ledger/ops/alerts.ts`
- Create: `tests/ledger/ops/alerts.test.ts`

- [ ] **Step 1: Write failing alert tests**

Test:

- stale worker heartbeat creates alert.
- stale ledger sync creates alert.
- key health `BLOCK` creates alert.
- repeated sync failure creates alert.
- reconciliation mismatch beyond threshold creates alert.
- backup failure creates alert.
- restore rehearsal overdue creates alert.
- alert payload excludes balances, secrets, signed URLs, and raw payloads.

Run:

```bash
npm run test -- tests/ledger/ops/alerts.test.ts
```

Expected: FAIL until alerts module exists.

- [ ] **Step 2: Implement alert evaluator**

Expose:

```ts
evaluateLedgerOpsAlerts(inputs): LedgerOpsAlert[]
```

Alert payload shape:

```ts
{
  severity: "info" | "warn" | "block",
  code: "ledger_sync_stale",
  title: "Ledger sync is stale",
  safeSummary: "No successful ledger sync in 4h",
  runbookRef: "p2-7-remote-ops/runbook.md#ledger-sync-stale"
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/ops/alerts.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 8: CLI and Package Scripts

**Files:**
- Create: `src/ledger/ops/cli.ts`
- Modify: `package.json`
- Create: `tests/ledger/ops/boundary.test.ts`

- [ ] **Step 1: Write failing CLI boundary tests**

Test:

- CLI supports `check`, `live-smoke`, `backup`, `restore-smoke`, and `alerts`.
- CLI output passes through redaction.
- default `npm run verify` does not include live smoke, backup, restore smoke, or remote export.
- ops modules do not import Prisma source fact create/update/delete helpers.
- ops modules do not expose `/api/binance/*`.

Run:

```bash
npm run test -- tests/ledger/ops/boundary.test.ts
```

Expected: FAIL until CLI/scripts exist.

- [ ] **Step 2: Implement CLI**

CLI shape:

```text
node --import tsx src/ledger/ops/cli.ts check
node --import tsx src/ledger/ops/cli.ts live-smoke
node --import tsx src/ledger/ops/cli.ts backup
node --import tsx src/ledger/ops/cli.ts restore-smoke --backup <path>
node --import tsx src/ledger/ops/cli.ts alerts
```

- [ ] **Step 3: Add package scripts**

Add:

```json
{
  "ledger:ops:check": "node --import tsx src/ledger/ops/cli.ts check",
  "ledger:live-smoke": "node --import tsx src/ledger/ops/cli.ts live-smoke",
  "ledger:backup": "node --import tsx src/ledger/ops/cli.ts backup",
  "ledger:restore-smoke": "node --import tsx src/ledger/ops/cli.ts restore-smoke",
  "ledger:ops:alerts": "node --import tsx src/ledger/ops/cli.ts alerts"
}
```

Do not add these scripts to `verify`.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/ops/boundary.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 9: Remote Ops Runbook

**Files:**
- Create: `docs/implementation/p2-ledger/p2-7-remote-ops/runbook.md`

- [ ] **Step 1: Write runbook**

Include:

- deployment sequence.
- migration sequence.
- post-deploy health check.
- live smoke usage.
- backup command.
- restore smoke command and scratch DB warning.
- remote export and local import flow.
- alert response guide.
- secret handling rules.
- rollback guidance.

- [ ] **Step 2: Self-review runbook**

Search for unfinished markers and secret-like assignment examples. Expected: no unfinished sections and no real or example secret values.

- [ ] **Step 3: Link runbook**

Link `runbook.md` from `docs/implementation/p2-ledger/p2-7-remote-ops/README.md`.

## Task 10: Final Verification

- [ ] Run:

```bash
npm run test -- tests/ledger/ops
npm run prisma:validate
npm run db:status
npm run verify
```

Expected: all commands exit 0.

- [ ] Confirm `npm run verify` remains offline.
- [ ] Confirm live smoke, backup, restore smoke, and export remain explicit opt-in.
- [ ] Confirm logs, alerts, export summaries, and backup metadata are redacted.
- [ ] Confirm restore smoke refuses production DB targets.
- [ ] Commit with message:

```text
ledger: implement remote operations

Adds P2-7 ops checks, backup/restore smoke, redaction, alerts, and runbook.
Generated by Codex.
```

## Acceptance Checklist

- [ ] Remote ops config check exists and does not print secret values.
- [ ] Live smoke is explicit opt-in and safe by default.
- [ ] Backup command produces metadata, checksum, table counts, and safe summary.
- [ ] Restore smoke uses a scratch database and refuses production targets.
- [ ] Redaction covers secret-bearing keys and text.
- [ ] Alerts use safe reason codes and no sensitive account values.
- [ ] Remote export/local import flow remains package-based.
- [ ] No ops module writes ledger source facts directly.
- [ ] `npm run verify` remains offline and exits 0.
