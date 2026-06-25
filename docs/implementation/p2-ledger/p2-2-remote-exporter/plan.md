# P2-2 Remote Exporter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a remote-only exporter that reads normalized ledger facts, redacts sensitive fields, emits `ledger_export_package` files, and records export metadata without acting as a Binance proxy.

**Architecture:** P2-2 reuses the P2-1 package contract and hash logic. It adds export scope resolution, redaction, package building from ledger tables, export metadata persistence, and an explicit export CLI. It reads ledger facts but never writes ledger source fact tables.

**Tech Stack:** TypeScript, Prisma, PostgreSQL, Zod, Node CLI via `tsx`, Vitest, P2-1 package module.

---

## Required Reading

- `docs/implementation/p2-ledger/p2-2-remote-exporter/design.md`
- `docs/implementation/p2-ledger/p2-1-local-import-cassette/design.md`
- `docs/implementation/p2-ledger/p2-0-ingest-kernel/design.md`
- `docs/decisions/0010-p2-remote-ledger-collector-and-local-import.md`

## File Structure

- Modify `prisma/schema.prisma`: add `LedgerExportRun`.
- Create `prisma/migrations/20260625100000_p2_remote_ledger_exporter/migration.sql`.
- Create `src/ledger/export/types.ts`.
- Create `src/ledger/export/scope.ts`.
- Create `src/ledger/export/redact.ts`.
- Create `src/ledger/export/build-package.ts`.
- Create `src/ledger/export/export-ledger-package.ts`.
- Create `src/ledger/export/cli.ts`.
- Modify `package.json`: add `ledger:export`.
- Create `tests/ledger/export/redact.test.ts`.
- Create `tests/ledger/export/build-package.test.ts`.
- Create `tests/ledger/export/export-ledger-package.test.ts`.
- Create `tests/ledger/export/no-proxy-boundary.test.ts`.

## Task 1: Export Metadata Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260625100000_p2_remote_ledger_exporter/migration.sql`

- [ ] **Step 1: Add failing metadata test**

Create `tests/ledger/export/export-ledger-package.test.ts` with an assertion that `prisma.ledgerExportRun` exists and can be counted.

Run:

```bash
npm run test -- tests/ledger/export/export-ledger-package.test.ts
```

Expected: FAIL because `ledgerExportRun` does not exist.

- [ ] **Step 2: Add Prisma model**

Add:

```prisma
enum LedgerExportRunStatus {
  succeeded
  failed
}

model LedgerExportRun {
  id             String               @id @default(uuid())
  exportRunId    String               @unique @map("export_run_id")
  schemaVersion  String               @map("schema_version")
  sourceEnvId    String               @map("source_env_id")
  actor          Json
  scope          Json
  rowCounts      Json                 @map("row_counts")
  redactionLevel String               @map("redaction_level")
  contentHash    String?              @map("content_hash")
  packagePath    String?              @map("package_path")
  status         LedgerExportRunStatus
  errorMessage   String?              @map("error_message")
  createdAt      DateTime             @default(now()) @map("created_at")

  @@index([status, createdAt])
  @@map("ledger_export_run")
}
```

- [ ] **Step 3: Generate migration**

Run:

```bash
npm run db:migrate -- --name p2_remote_ledger_exporter
```

Expected: migration is created and Prisma client regenerates. Rename the migration directory to `20260625100000_p2_remote_ledger_exporter` before commit if needed.

- [ ] **Step 4: Run checks**

Run:

```bash
npm run prisma:validate
npm run db:status
npm run test -- tests/ledger/export/export-ledger-package.test.ts
```

Expected: all commands exit 0.

## Task 2: Redaction

**Files:**
- Create: `src/ledger/export/redact.ts`
- Create: `tests/ledger/export/redact.test.ts`

- [ ] **Step 1: Write failing redaction tests**

Test:

- removes or masks `apiKey`, `apiSecret`, `signature`, `headers`, `signedUrl`, `listenKey`.
- rejects a payload when strict redaction sees an unknown secret-like key.
- preserves safe domain fields like asset, symbol, amount strings, strategy IDs.

Run:

```bash
npm run test -- tests/ledger/export/redact.test.ts
```

Expected: FAIL because redactor does not exist.

- [ ] **Step 2: Implement redactor**

Implement:

- `redactLedgerPayload(value, { strict: true })`.
- recursive object/array traversal.
- allowlist for safe fields.
- blocklist for secret-like fields.
- stable output for hashing.

- [ ] **Step 3: Run redaction tests**

Run:

```bash
npm run test -- tests/ledger/export/redact.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 3: Export Scope and Package Builder

**Files:**
- Create: `src/ledger/export/types.ts`
- Create: `src/ledger/export/scope.ts`
- Create: `src/ledger/export/build-package.ts`
- Create: `tests/ledger/export/build-package.test.ts`

- [ ] **Step 1: Write failing package builder tests**

Test:

- builds a package from fixture ledger facts inserted through `appendLedgerFacts()`.
- package manifest uses `package_kind = "remote_export"`.
- row counts match exported sections.
- package hash is stable.
- package validates with P2-1 schema.

Run:

```bash
npm run test -- tests/ledger/export/build-package.test.ts
```

Expected: FAIL because export builder modules do not exist.

- [ ] **Step 2: Implement export types**

Define scopes:

- `latest_successful_sync`
- `sync_run_id`
- `time_window`
- `all_since`
- `fixture_scope`

Define `LedgerExportOptions` with `source_env_id`, `actor`, `scope`, `redaction_level`, and `out`.

- [ ] **Step 3: Implement scope resolver**

Resolve each supported scope into Prisma filters over P2-0 source fact tables. For initial implementation, `fixture_scope` and `time_window` are enough for deterministic tests; other scopes can return explicit unsupported errors until P2-3 job metadata is available.

- [ ] **Step 4: Implement package builder**

Read source tables:

- `exchangeTradeFill`
- `exchangeOrder`
- `capitalFlowEvent`
- `externalTrade`
- `attributionRecord`
- `ledgerReversal`
- `accountBalanceSnapshot`
- `syncCursor`

Map rows into P2-1 package sections after redaction. Compute `content_hash`.

- [ ] **Step 5: Run package builder tests**

Run:

```bash
npm run test -- tests/ledger/export/build-package.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 4: Export Command and Metadata Persistence

**Files:**
- Create: `src/ledger/export/export-ledger-package.ts`
- Create: `src/ledger/export/cli.ts`
- Modify: `package.json`
- Modify: `tests/ledger/export/export-ledger-package.test.ts`

- [ ] **Step 1: Extend failing export tests**

Test:

- successful export writes a package file.
- successful export writes `LedgerExportRun` metadata with hash, scope, row counts, path, and actor.
- redaction failure writes failed metadata and no package path.
- importing the exported package through P2-1 succeeds.

Run:

```bash
npm run test -- tests/ledger/export/export-ledger-package.test.ts
```

Expected: FAIL because export command does not exist.

- [ ] **Step 2: Implement export service**

`exportLedgerPackage(options)`:

1. resolves scope,
2. builds package,
3. writes package file,
4. records `LedgerExportRun`,
5. returns safe summary.

Use explicit output path. Do not create public endpoints in this phase.

- [ ] **Step 3: Add CLI and package script**

Add:

```json
{
  "ledger:export": "node --import tsx src/ledger/export/cli.ts"
}
```

Support:

```text
npm run ledger:export -- --scope fixture_scope --out tmp/ledger/exports/fixture.json
```

- [ ] **Step 4: Run export tests**

Run:

```bash
npm run test -- tests/ledger/export/export-ledger-package.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 5: Boundary Guard

**Files:**
- Create: `tests/ledger/export/no-proxy-boundary.test.ts`

- [ ] **Step 1: Add proxy/boundary tests**

Test:

- no route path under `src/app/api/binance`.
- exporter source does not call Binance client modules.
- exporter source does not write P2-0 source fact tables.
- exporter package contains no secret-like fields.

Run:

```bash
npm run test -- tests/ledger/export/no-proxy-boundary.test.ts
```

Expected: exits 0 after boundary guard is implemented.

## Task 6: Final Verification

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- tests/ledger/export/redact.test.ts tests/ledger/export/build-package.test.ts tests/ledger/export/export-ledger-package.test.ts tests/ledger/export/no-proxy-boundary.test.ts
npm run typecheck
npm run prisma:validate
npm run db:status
```

Expected: all commands exit 0.

- [ ] **Step 2: Run aggregate gate**

Run:

```bash
npm run verify
```

Expected: exits 0 and does not call live Binance.

## Acceptance Checklist

- Exporter reads normalized ledger facts and writes package files.
- Exporter writes `LedgerExportRun` metadata.
- Exporter redacts secret-like fields before hashing.
- Exported package validates through P2-1 package schema.
- Tampered export fails local import.
- No `/api/binance/*` proxy exists.
- Exporter does not write ledger source fact tables.
- `npm run verify` remains offline.
