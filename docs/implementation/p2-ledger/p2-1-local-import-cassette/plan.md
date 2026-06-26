# P2-1 Mock, Local Import, and Cassette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline ledger data lane: deterministic mock packages, local package import, and cassette fixtures, all routed through `appendLedgerFacts()`.

**Architecture:** P2-1 adds a shared ledger package module, deterministic mock scenario generator, package hash/schema validation, package-to-ingest mapper, local import command, and cassette promotion flow. It reuses P2-0 ingest types and service; it does not write ledger fact tables directly.

**Tech Stack:** TypeScript, Zod, Node CLI via `tsx`, Vitest, existing Prisma/Postgres test DB, P2-0 `appendLedgerFacts()`.

---

## Required Reading

- `docs/implementation/p2-ledger/p2-1-local-import-cassette/design.md`
- `docs/implementation/p2-ledger/p2-0-ingest-kernel/design.md`
- `docs/implementation/p2-ledger/p2-0-ingest-kernel/plan.md`
- `docs/implementation/p2-ledger/00-acceptance.md`
- `docs/decisions/0010-p2-remote-ledger-collector-and-local-import.md`

## File Structure

- Create `src/ledger/package/types.ts`: package manifest, package row, and package result types.
- Create `src/ledger/package/schema.ts`: Zod package schema and validation.
- Create `src/ledger/package/hash.ts`: package hash calculation and verification using P2-0 canonical hash.
- Create `src/ledger/package/map-to-ingest.ts`: package sections to `LedgerIngestCommand`.
- Create `src/ledger/package/import-package.ts`: validate, hash-check, map, and call `appendLedgerFacts()`.
- Create `src/ledger/mock/scenarios.ts`: named deterministic mock scenario definitions.
- Create `src/ledger/mock/generate-package.ts`: mock package generator.
- Create `src/ledger/cassette/promote.ts`: cassette promotion helper.
- Create `src/ledger/package/cli.ts`: local package CLI entrypoint.
- Modify `src/ledger/index.ts`: export package/mock helpers only through stable barrels if needed.
- Modify `package.json`: add local offline scripts.
- Create `tests/ledger/package/package-schema.test.ts`.
- Create `tests/ledger/package/mock-package.test.ts`.
- Create `tests/ledger/package/import-package.test.ts`.
- Create `tests/ledger/package/cassette.test.ts`.
- Create `tests/fixtures/ledger/cassettes/cassette_p2_1_deposit_buy_fee.json`.

## Task 1: Package Contract, Schema, and Hash

**Files:**
- Create: `src/ledger/package/types.ts`
- Create: `src/ledger/package/schema.ts`
- Create: `src/ledger/package/hash.ts`
- Create: `tests/ledger/package/package-schema.test.ts`

- [ ] **Step 1: Write failing package schema tests**

Create tests that prove:

- `ledger.export.v1` package with required sections validates.
- decimal-like fields reject JS numbers for known amount/price/qty/fee keys.
- `content_hash` verification passes for canonical package content.
- tampered package content fails hash verification.
- secret-like fields fail validation.

Run:

```bash
npm run test -- tests/ledger/package/package-schema.test.ts
```

Expected: FAIL because package modules do not exist.

- [ ] **Step 2: Implement package types**

Define:

- `LedgerPackageKind = "mock" | "remote_export" | "cassette"`.
- `LedgerPackageManifest`.
- section row types with `idempotency_key`, `natural_key`, `origin`, `occurred_at`, `payload`, and optional `payload_hash`.
- `LedgerExportPackage`.

Keep decimals as strings and timestamps as ISO strings.

- [ ] **Step 3: Implement schema validation**

Use Zod to validate the full package envelope. Require all top-level arrays, even when empty:

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
- `raw_payload_redacted`

Reject keys matching secret-like names: `apiKey`, `apiSecret`, `signature`, `signedUrl`, `headers`, `secret`, `listenKey`.

Validate section class semantics:

- source fact sections are eligible for `appendLedgerFacts()`.
- `exchange_accounts` and `api_key_health_summaries` are read-only summaries and must not create credentials or key material.
- `reconciliation_results` are derived results; before P2-4 import support exists, validation keeps them safe but importer returns an explicit `ignored_until_phase: "P2-4"` warning.
- `sync_cursor_summaries` must not advance cursors unless trusted restore mode is explicitly requested.
- `raw_payload_redacted` must remain redacted evidence and must not map to source facts.

- [ ] **Step 4: Implement hash calculation**

Implement:

- `packageContentForHash(package)`: returns package with `manifest.content_hash = ""`.
- `calculatePackageHash(package)`: returns `sha256:...`.
- `verifyPackageHash(package)`: throws when `manifest.content_hash` does not match.

Reuse P2-0 canonical hashing instead of inventing a second hash format.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- tests/ledger/package/package-schema.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 2: Deterministic Mock Ledger Service

**Files:**
- Create: `src/ledger/mock/scenarios.ts`
- Create: `src/ledger/mock/generate-package.ts`
- Create: `tests/ledger/package/mock-package.test.ts`

- [ ] **Step 1: Write failing mock package tests**

Test:

- same scenario generates byte-stable canonical package JSON/hash.
- `deposit_buy_fee` includes one deposit, one buy fill, one fee-bearing fill, and one balance snapshot.
- every generated fact has mock origin metadata.
- every generated package has `package_kind = "mock"`.

Run:

```bash
npm run test -- tests/ledger/package/mock-package.test.ts
```

Expected: FAIL because mock generator does not exist.

- [ ] **Step 2: Implement scenarios**

Implement these scenario IDs exactly:

- `empty_healthy_account`
- `deposit_buy_fee`
- `partial_sell_lot`
- `master_to_sub_transfer`
- `missing_event_mismatch`
- `external_wallet_pending_attribution`
- `duplicate_import`
- `mixed_origin_package`

Use fixed timestamps under `2026-06-25T00:00:00.000Z` and deterministic IDs.

- [ ] **Step 3: Implement package generator**

`generateMockLedgerPackage({ scenarioId })` returns a complete package with:

- `source_env_id = "mock-local"`
- `redaction_level = "none"`
- deterministic `package_id`
- deterministic `content_hash`

It does not call network or database.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/package/mock-package.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 3: Package Import Through appendLedgerFacts

**Files:**
- Create: `src/ledger/package/map-to-ingest.ts`
- Create: `src/ledger/package/import-package.ts`
- Create: `tests/ledger/package/import-package.test.ts`

- [ ] **Step 1: Write failing import tests**

Test:

- mock package imports with `source_mode = "mock"`.
- remote export package imports with `source_mode = "remote_import"`.
- cassette package imports with `source_mode = "cassette"`.
- re-importing the same package is idempotent.
- malformed hash fails before `appendLedgerFacts()` is called.
- mixed-origin packages preserve fact-level origin.

Run:

```bash
npm run test -- tests/ledger/package/import-package.test.ts
```

Expected: FAIL because importer does not exist.

- [ ] **Step 2: Implement mapper**

Map sections:

- `exchange_trade_fills` -> `exchange_trade_fill`.
- `exchange_orders` -> `exchange_order`.
- `capital_flow_events` -> `capital_flow_event`.
- `external_trades` -> `external_trade`.
- `attribution_records` -> `attribution_record`.
- `reversals` -> `reversal`.
- `account_balance_snapshots` -> `account_balance_snapshot`.

Set batch package metadata from `manifest`.

Do not map these sections to `appendLedgerFacts()`:

- `exchange_accounts`
- `api_key_health_summaries`
- `reconciliation_results`
- `raw_payload_redacted`

Handle them according to the section semantics in Task 1. `sync_cursor_summaries` become `cursor_advancements` only when the import call is in explicit trusted restore mode.

Map manifest fields to P2-0 metadata exactly as defined in the design. In particular, `manifest.produced_at` becomes `package_metadata.produced_at` and `import_metadata.exported_at`; do not invent a second timestamp field during import.

- [ ] **Step 3: Implement importer**

`importLedgerPackage(packageOrPath)`:

1. parses JSON when given a path,
2. validates schema,
3. verifies hash,
4. maps to `LedgerIngestCommand`,
5. calls `appendLedgerFacts()`,
6. returns safe import summary.

The importer must not write Prisma source fact tables directly.
The import summary must list ignored non-source sections and the reason, rather than silently dropping them.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/package/import-package.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 4: Cassette Promotion and Fixtures

**Files:**
- Create: `src/ledger/cassette/promote.ts`
- Create: `tests/fixtures/ledger/cassettes/cassette_p2_1_deposit_buy_fee.json`
- Create: `tests/ledger/package/cassette.test.ts`

- [ ] **Step 1: Write failing cassette tests**

Test:

- promoted cassette has `package_kind = "cassette"`.
- promoted cassette has immutable `cassette_id`.
- promoted cassette validates and imports with `source_mode = "cassette"`.
- committed cassette fixture contains no secret-like fields.

Run:

```bash
npm run test -- tests/ledger/package/cassette.test.ts
```

Expected: FAIL because cassette helper/fixture does not exist.

- [ ] **Step 2: Implement cassette promotion**

`promotePackageToCassette(package, cassetteId)`:

- sets `package_kind = "cassette"`,
- sets `cassette_id`,
- sets `source_env_id = "cassette-fixture"`,
- recalculates content hash,
- rejects packages with `redaction_level` missing.

- [ ] **Step 3: Add deterministic cassette fixture**

Generate the fixture from `deposit_buy_fee`. Commit the JSON only after validation confirms no secret-like fields.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/package/cassette.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 5: Offline CLI Scripts

**Files:**
- Create: `src/ledger/package/cli.ts`
- Modify: `package.json`
- Test: reuse `tests/ledger/package/*.test.ts`

- [ ] **Step 1: Add CLI entrypoint**

Support commands:

```text
mock-package --scenario deposit_buy_fee --out tmp/ledger/mock/deposit_buy_fee.json
import-package --file tmp/ledger/mock/deposit_buy_fee.json
cassette-promote --file tmp/ledger/mock/deposit_buy_fee.json --cassette-id cassette_p2_1_deposit_buy_fee --out tests/fixtures/ledger/cassettes/cassette_p2_1_deposit_buy_fee.json
```

- [ ] **Step 2: Add package scripts**

Add scripts:

```json
{
  "ledger:mock-package": "node --import tsx src/ledger/package/cli.ts mock-package",
  "ledger:import-package": "node --import tsx src/ledger/package/cli.ts import-package",
  "ledger:cassette:promote": "node --import tsx src/ledger/package/cli.ts cassette-promote"
}
```

- [ ] **Step 3: Run local CLI smoke**

Run:

```bash
npm run ledger:mock-package -- --scenario deposit_buy_fee --out tmp/ledger/mock/deposit_buy_fee.json
npm run ledger:import-package -- --file tmp/ledger/mock/deposit_buy_fee.json
```

Expected: both commands exit 0 without network access.

## Task 6: Final Verification

**Files:**
- Update this plan only if execution reveals a mismatch.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- tests/ledger/package/package-schema.test.ts tests/ledger/package/mock-package.test.ts tests/ledger/package/import-package.test.ts tests/ledger/package/cassette.test.ts
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 2: Run aggregate gate**

Run:

```bash
npm run verify
```

Expected: exits 0 and does not call live Binance.

- [ ] **Step 3: Self-review**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only P2-1 implementation files are staged for commit.

## Acceptance Checklist

- Mock package generation is deterministic.
- Local import verifies hash before ingestion.
- Local import calls `appendLedgerFacts()` for every source fact.
- No P2-1 module writes ledger source tables directly.
- Mock, cassette, and remote import source modes are distinct.
- Mixed-origin packages preserve fact-level origin metadata.
- Cassettes are safe to commit.
- `npm run verify` remains offline.
