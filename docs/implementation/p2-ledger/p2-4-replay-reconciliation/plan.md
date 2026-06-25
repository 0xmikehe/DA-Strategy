# P2-4 Replay and Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement deterministic replay from ledger source facts and append-only reconciliation results that compare computed balances with reported account snapshots.

**Architecture:** P2-4 adds a ledger replay module, canonical replay events, decimal-safe accounting helpers, FIFO lot logic, conservation diagnostics, reconciliation classification, and an append-only result writer. It reads source facts, writes only reconciliation audit/result state, and never repairs account facts directly.

**Tech Stack:** TypeScript, Prisma, Zod, Vitest, existing local Postgres verification gate, decimal-safe arithmetic helper or an approved decimal library.

---

## Required Reading

- `AGENTS.md`
- `docs/prd/账本层PRD_v0.1.md` sections 1.5, 1.6, and 5
- `docs/implementation/p2-ledger/p2-4-replay-reconciliation/design.md`
- `docs/implementation/p2-ledger/p2-0-ingest-kernel/design.md`
- `docs/implementation/p2-ledger/p2-1-local-import-cassette/design.md`
- `docs/implementation/p2-ledger/p2-3-binance-live-sync/design.md`

## File Structure

- Modify `prisma/schema.prisma`: add `ReconciliationResult` and optional `ReplayRun` if not already present.
- Create `prisma/migrations/20260625120000_p2_replay_reconciliation/migration.sql`.
- Create `src/ledger/replay/types.ts`.
- Create `src/ledger/replay/decimal.ts`.
- Create `src/ledger/replay/event-reader.ts`.
- Create `src/ledger/replay/event-normalizer.ts`.
- Create `src/ledger/replay/replay-engine.ts`.
- Create `src/ledger/replay/lot-engine.ts`.
- Create `src/ledger/replay/conservation.ts`.
- Create `src/ledger/reconciliation/types.ts`.
- Create `src/ledger/reconciliation/reconcile.ts`.
- Create `src/ledger/reconciliation/result-writer.ts`.
- Create `src/ledger/reconciliation/cli.ts`.
- Create `tests/ledger/replay/replay-engine.test.ts`.
- Create `tests/ledger/replay/lot-engine.test.ts`.
- Create `tests/ledger/replay/reversal.test.ts`.
- Create `tests/ledger/reconciliation/reconcile.test.ts`.
- Create `tests/ledger/reconciliation/boundary.test.ts`.

## Task 1: Schema and Result Contract

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260625120000_p2_replay_reconciliation/migration.sql`
- Create: `src/ledger/reconciliation/types.ts`
- Create: `tests/ledger/reconciliation/reconcile.test.ts`

- [ ] **Step 1: Write failing reconciliation type tests**

Test:

- valid statuses are exactly `MATCHED`, `MISSING_EVENT`, `EXTERNAL_BALANCE_MISMATCH`, and `NEEDS_CLASSIFICATION`.
- result quantities are decimal strings.
- result references a snapshot when reported balance exists.
- missing snapshot is represented explicitly, not as `MATCHED`.

Run:

```bash
npm run test -- tests/ledger/reconciliation/reconcile.test.ts
```

Expected: FAIL because reconciliation contracts do not exist.

- [ ] **Step 2: Add append-only result models**

Add `ReconciliationResult`.

Recommended fields:

- `id`
- `runId`
- `accountId`
- `asset`
- `computedQty`
- `reportedQty`
- `diffQty`
- `thresholdQty`
- `status`
- `snapshotRef`
- `checkedAt`
- `note`
- `diagnosticsJson`
- `createdAt`

Optional `ReplayRun` may record trigger, `asOf`, event counts, and run diagnostics. Do not add persistent balance, position, or lot projection tables in P2-4.

- [ ] **Step 3: Generate migration**

Run:

```bash
npm run db:migrate -- --name p2_replay_reconciliation
```

Expected: migration created. Rename directory to `20260625120000_p2_replay_reconciliation` before commit if needed.

- [ ] **Step 4: Run validation**

Run:

```bash
npm run prisma:validate
npm run typecheck
```

Expected: both commands exit 0.

## Task 2: Canonical Replay Events and Reader

**Files:**
- Create: `src/ledger/replay/types.ts`
- Create: `src/ledger/replay/event-reader.ts`
- Create: `src/ledger/replay/event-normalizer.ts`
- Create: `tests/ledger/replay/replay-engine.test.ts`

- [ ] **Step 1: Write failing reader/normalizer tests**

Use P2-0 test builders or minimal seeded rows.

Test:

- source rows normalize to `trade_fill`, `capital_flow`, `external_trade`, `attribution`, and `reversal`.
- sorting is deterministic when timestamps tie.
- decimal fields remain strings.
- unknown source kind fails closed.

Run:

```bash
npm run test -- tests/ledger/replay/replay-engine.test.ts
```

Expected: FAIL because replay modules do not exist.

- [ ] **Step 2: Implement canonical event types**

Define canonical events with only accounting fields needed by replay. Keep exchange-specific payload details outside the replay engine.

- [ ] **Step 3: Implement event reader and normalizer**

The reader may use Prisma. The normalizer should be testable without DB.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/replay/replay-engine.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 3: Replay Engine and Lots

**Files:**
- Create: `src/ledger/replay/decimal.ts`
- Create: `src/ledger/replay/replay-engine.ts`
- Create: `src/ledger/replay/lot-engine.ts`
- Create: `tests/ledger/replay/replay-engine.test.ts`
- Create: `tests/ledger/replay/lot-engine.test.ts`
- Create: `tests/ledger/replay/reversal.test.ts`

- [ ] **Step 1: Write failing accounting tests**

Test:

- deposit increases account balance.
- withdrawal decreases account balance.
- buy fill increases base asset and decreases quote asset.
- sell fill decreases base asset and increases quote asset.
- fee subtracts from the fee asset.
- master-to-sub transfer preserves global conservation.
- external trade affects an external wallet account.
- attribution affects strategy position but not account balance.
- reversal cancels target fact effect without deleting target evidence.
- partial sell consumes FIFO lots.

Run:

```bash
npm run test -- tests/ledger/replay/replay-engine.test.ts tests/ledger/replay/lot-engine.test.ts tests/ledger/replay/reversal.test.ts
```

Expected: FAIL until replay engine exists.

- [ ] **Step 2: Implement decimal helper**

Add one safe arithmetic surface for quantities:

- parse decimal strings.
- add/subtract/compare.
- format canonical decimal strings.
- reject JS `number` inputs.

Use an existing project decimal helper if one exists. If adding a dependency, keep it scoped and update lockfiles normally.

- [ ] **Step 3: Implement replay fold**

Implement `replayLedgerFacts(events, options)`.

Return:

- `accountBalances`
- `strategyPositions`
- `lots`
- `realizedPnl`
- `unassigned`
- `diagnostics`

- [ ] **Step 4: Implement FIFO lot engine**

Initial FIFO rules:

- buy opens lots for base asset.
- sell consumes oldest available lots.
- fees in base asset reduce received or remaining quantity as appropriate.
- unsupported fee cases create diagnostics rather than silent math.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- tests/ledger/replay
npm run typecheck
```

Expected: both commands exit 0.

## Task 4: Conservation Diagnostics

**Files:**
- Create: `src/ledger/replay/conservation.ts`
- Extend: `tests/ledger/replay/replay-engine.test.ts`

- [ ] **Step 1: Write failing conservation tests**

Test:

- account balances equal strategy positions plus master/unassigned by asset.
- missing attribution creates unassigned quantity instead of disappearing value.
- orphan attribution produces a diagnostic.
- reversed missing target produces a diagnostic.

Run:

```bash
npm run test -- tests/ledger/replay/replay-engine.test.ts
```

Expected: FAIL until conservation checks exist.

- [ ] **Step 2: Implement conservation checks**

Checks should return structured diagnostics that P2-6 can display. Do not mutate replay output to hide failures.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/replay/replay-engine.test.ts
```

Expected: command exits 0.

## Task 5: Reconciliation Classification and Writer

**Files:**
- Create: `src/ledger/reconciliation/reconcile.ts`
- Create: `src/ledger/reconciliation/result-writer.ts`
- Create: `tests/ledger/reconciliation/reconcile.test.ts`
- Create: `tests/ledger/reconciliation/boundary.test.ts`

- [ ] **Step 1: Write failing reconciliation tests**

Test:

- computed equals reported within threshold -> `MATCHED`.
- reported greater than computed -> `MISSING_EVENT`.
- computed greater than reported -> `EXTERNAL_BALANCE_MISMATCH`.
- replay diagnostics can escalate to `NEEDS_CLASSIFICATION`.
- result writer appends new records and does not update previous results.
- result writer cannot write source fact tables or sync cursors.

Run:

```bash
npm run test -- tests/ledger/reconciliation
```

Expected: FAIL until reconciliation exists.

- [ ] **Step 2: Implement classifier**

Use asset-aware thresholds. Start with a conservative default and make per-asset precision injectable.

- [ ] **Step 3: Implement result writer**

The writer records append-only `reconciliation_result` rows. It must not call `appendLedgerFacts()` unless a later accepted ADR makes reconciliation results part of the ingest command contract.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/reconciliation
npm run typecheck
```

Expected: both commands exit 0.

## Task 6: CLI and Trigger Integration

**Files:**
- Create: `src/ledger/reconciliation/cli.ts`
- Modify: `package.json`
- Extend: integration tests as needed.

- [ ] **Step 1: Add explicit local command**

Add:

```text
npm run ledger:reconcile
```

The command reads local DB facts and writes reconciliation results. It must not call Binance.

- [ ] **Step 2: Add service entrypoint for P2-3/P2-5 triggers**

Expose a service function that P2-3 live sync and P2-5 manual writes can call after successful ingest.

- [ ] **Step 3: Run smoke tests**

Run:

```bash
npm run ledger:reconcile -- --as-of 2026-06-25T00:00:00.000Z
```

Expected: command completes against local fixture/mock data, or reports no eligible snapshots with a safe message.

## Task 7: Final Verification

- [ ] Run:

```bash
npm run prisma:validate
npm run db:status
npm run test -- tests/ledger/replay tests/ledger/reconciliation
npm run verify
```

Expected: all commands exit 0.

- [ ] Confirm no default test or verify command calls live Binance.
- [ ] Confirm no replay/reconciliation module writes source fact tables.
- [ ] Inspect diff for accidental persistent balance/position/lot projection tables.
- [ ] Commit with message:

```text
ledger: implement replay and reconciliation

Implements P2-4 deterministic replay and append-only reconciliation results.
Generated by Codex.
```

## Acceptance Checklist

- [ ] Replay is deterministic for the same source facts and `asOf`.
- [ ] Replay supports core fact kinds from P2-0.
- [ ] Reversal cancels accounting effect without deleting evidence.
- [ ] FIFO lot behavior is covered by tests.
- [ ] Conservation diagnostics are structured.
- [ ] Reconciliation writes append-only result records.
- [ ] `MATCHED`, `MISSING_EVENT`, `EXTERNAL_BALANCE_MISMATCH`, and `NEEDS_CLASSIFICATION` are covered.
- [ ] P2-4 does not call Binance.
- [ ] P2-4 does not write account source facts, sync cursors, or manual corrections.
- [ ] `npm run verify` exits 0.
