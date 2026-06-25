# P2-5 Manual Fallback Writes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement manual external trade entry, attribution, and reversal services that validate user intent, normalize it into `LedgerIngestCommand`, and write only through `appendLedgerFacts()`.

**Architecture:** P2-5 adds manual command schemas, validation services, command-to-ingest mappers, idempotency key builders, pending attribution read queries, and replay/reconciliation trigger integration. It owns manual fallback command handling but never writes source fact tables directly.

**Tech Stack:** TypeScript, Zod, Prisma read queries, existing `appendLedgerFacts()` service, Vitest, optional Next.js server actions or API routes only when P2-6 wires the page.

---

## Required Reading

- `AGENTS.md`
- `docs/prd/账本层PRD_v0.1.md` sections 4, 5.6, and 6
- `docs/implementation/p2-ledger/p2-5-manual-fallback-writes/design.md`
- `docs/implementation/p2-ledger/p2-0-ingest-kernel/design.md`
- `docs/implementation/p2-ledger/p2-4-replay-reconciliation/design.md`

## File Structure

- Create `src/ledger/manual/types.ts`.
- Create `src/ledger/manual/schemas.ts`.
- Create `src/ledger/manual/idempotency.ts`.
- Create `src/ledger/manual/validation.ts`.
- Create `src/ledger/manual/external-trade-service.ts`.
- Create `src/ledger/manual/attribution-service.ts`.
- Create `src/ledger/manual/reversal-service.ts`.
- Create `src/ledger/manual/pending-attribution.ts`.
- Create `src/ledger/manual/reconcile-trigger.ts`.
- Create `src/ledger/manual/cli.ts`.
- Create `tests/ledger/manual/external-trade-service.test.ts`.
- Create `tests/ledger/manual/attribution-service.test.ts`.
- Create `tests/ledger/manual/reversal-service.test.ts`.
- Create `tests/ledger/manual/pending-attribution.test.ts`.
- Create `tests/ledger/manual/boundary.test.ts`.
- Modify `package.json`: add explicit local operator commands if CLI is implemented in this phase.

## Task 1: Manual Command Contracts

**Files:**
- Create: `src/ledger/manual/types.ts`
- Create: `src/ledger/manual/schemas.ts`
- Create: `tests/ledger/manual/external-trade-service.test.ts`
- Create: `tests/ledger/manual/attribution-service.test.ts`
- Create: `tests/ledger/manual/reversal-service.test.ts`

- [ ] **Step 1: Write failing schema tests**

Test:

- external trade requires account, side, base/quote assets, quantity, price or quote quantity, and `occurred_at`.
- quantities/prices are positive decimal strings.
- future `occurred_at` is rejected.
- attribution requires a target fact and assignment kind.
- reversal requires a target fact and reason.
- manual balance adjustment command is not part of the public schema.

Run:

```bash
npm run test -- tests/ledger/manual/external-trade-service.test.ts tests/ledger/manual/attribution-service.test.ts tests/ledger/manual/reversal-service.test.ts
```

Expected: FAIL because manual schemas do not exist.

- [ ] **Step 2: Implement Zod schemas**

Create command schemas:

- `ManualExternalTradeCommandSchema`
- `ManualAttributionCommandSchema`
- `ManualReversalCommandSchema`

Keep the public command surface small. Do not add `manual_balance_adjustment`.

- [ ] **Step 3: Run schema tests**

Run:

```bash
npm run test -- tests/ledger/manual/external-trade-service.test.ts tests/ledger/manual/attribution-service.test.ts tests/ledger/manual/reversal-service.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 2: Validation and Idempotency

**Files:**
- Create: `src/ledger/manual/idempotency.ts`
- Create: `src/ledger/manual/validation.ts`
- Extend: manual service tests

- [ ] **Step 1: Write failing validation tests**

Test:

- unknown account is rejected.
- unknown asset is rejected.
- unknown strategy/version is rejected for strategy attribution.
- attribution target must exist.
- reversal target must exist and must not already be reversed.
- same command produces same idempotency key.
- changed payload with same request ID is treated as conflict by ingest.

Run:

```bash
npm run test -- tests/ledger/manual
```

Expected: FAIL until validators exist.

- [ ] **Step 2: Implement validators**

Validators may read via Prisma but must not write. Keep dependencies injectable for unit tests.

- [ ] **Step 3: Implement idempotency builders**

Recommended key shapes:

- `manual_external_trade:{request_id}`
- `manual_attribution:{target_kind}:{target_key}:{assignment_version_or_request_id}`
- `manual_reversal:{target_kind}:{target_key}:{request_id}`

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/manual
npm run typecheck
```

Expected: both commands exit 0.

## Task 3: External Trade Service

**Files:**
- Create: `src/ledger/manual/external-trade-service.ts`
- Create: `tests/ledger/manual/external-trade-service.test.ts`

- [ ] **Step 1: Write failing service tests**

Test:

- service calls `appendLedgerFacts()` exactly once.
- command maps to `facts.kind = "external_trade"`.
- batch uses `source_mode = "live"` for official-runtime manual command.
- origin is `manual_external_trade`.
- trigger is `manual_entry`.
- actor is preserved.
- optional strategy attribution adds `attribution_record` in the same batch.
- service does not use Prisma source table create/update methods.

Run:

```bash
npm run test -- tests/ledger/manual/external-trade-service.test.ts
```

Expected: FAIL until service exists.

- [ ] **Step 2: Implement external trade service**

Expose:

```ts
submitManualExternalTrade(command, context)
```

Return a safe summary suitable for P2-6.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/manual/external-trade-service.test.ts
```

Expected: command exits 0.

## Task 4: Attribution Service

**Files:**
- Create: `src/ledger/manual/attribution-service.ts`
- Create: `tests/ledger/manual/attribution-service.test.ts`

- [ ] **Step 1: Write failing attribution tests**

Test:

- single attribution maps to `facts.kind = "attribution_record"`.
- batch attribution validates all targets before ingest.
- re-attribution appends a new record and does not update old records.
- attribution does not produce account balance facts.
- origin is `manual_attribution`.
- trigger is `manual_attribution`.

Run:

```bash
npm run test -- tests/ledger/manual/attribution-service.test.ts
```

Expected: FAIL until service exists.

- [ ] **Step 2: Implement attribution service**

Expose:

```ts
submitManualAttribution(command, context)
submitManualAttributionBatch(commands, context)
```

Batch service must fail before ingest if any target is invalid.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/manual/attribution-service.test.ts
```

Expected: command exits 0.

## Task 5: Reversal Service

**Files:**
- Create: `src/ledger/manual/reversal-service.ts`
- Create: `tests/ledger/manual/reversal-service.test.ts`

- [ ] **Step 1: Write failing reversal tests**

Test:

- reversal maps to `facts.kind = "reversal"`.
- target fact is referenced by kind and ID/idempotency key.
- target row is not updated or deleted.
- replacement fact can be submitted in a follow-up manual command.
- reversing a reversal is rejected in initial implementation.
- origin is `manual_reversal`.
- trigger is `manual_reversal`.

Run:

```bash
npm run test -- tests/ledger/manual/reversal-service.test.ts
```

Expected: FAIL until service exists.

- [ ] **Step 2: Implement reversal service**

Expose:

```ts
submitManualReversal(command, context)
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/manual/reversal-service.test.ts
```

Expected: command exits 0.

## Task 6: Pending Attribution Read Query

**Files:**
- Create: `src/ledger/manual/pending-attribution.ts`
- Create: `tests/ledger/manual/pending-attribution.test.ts`

- [ ] **Step 1: Write failing pending queue tests**

Test:

- external trade without effective attribution appears in pending queue.
- attributed fact disappears from pending queue.
- latest attribution wins.
- query is read-only.
- result includes source mode, origin, account, asset, quantity, occurred time, and suggested reason where available.

Run:

```bash
npm run test -- tests/ledger/manual/pending-attribution.test.ts
```

Expected: FAIL until query exists.

- [ ] **Step 2: Implement read query**

Start as computed query over source facts and attribution records. Do not add a materialized pending queue unless implementation proves it is necessary.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/manual/pending-attribution.test.ts
```

Expected: command exits 0.

## Task 7: Replay/Reconciliation Trigger Integration

**Files:**
- Create: `src/ledger/manual/reconcile-trigger.ts`
- Extend: manual service tests

- [ ] **Step 1: Write failing trigger tests**

Test:

- after successful manual ingest, service calls P2-4 trigger once.
- if ingest fails, trigger is not called.
- if trigger fails after ingest, manual service returns committed fact summary plus retryable reconciliation failure.

Run:

```bash
npm run test -- tests/ledger/manual
```

Expected: FAIL until trigger integration exists.

- [ ] **Step 2: Implement trigger adapter**

Keep trigger dependency injectable so tests can avoid running full replay.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/manual
```

Expected: command exits 0.

## Task 8: CLI and Boundary Guard

**Files:**
- Create: `src/ledger/manual/cli.ts`
- Modify: `package.json`
- Create: `tests/ledger/manual/boundary.test.ts`

- [ ] **Step 1: Add optional operator CLI**

Add explicit local commands if useful:

```text
npm run ledger:manual:external-trade
npm run ledger:manual:attribute
npm run ledger:manual:reverse
```

These commands are local/operator tools. They do not call Binance.

- [ ] **Step 2: Add boundary tests**

Test:

- manual services import `appendLedgerFacts`.
- manual services do not call Prisma source table create/update/delete.
- no exported public function accepts a balance-adjustment command.

Run:

```bash
npm run test -- tests/ledger/manual/boundary.test.ts
```

Expected: command exits 0.

## Task 9: Final Verification

- [ ] Run:

```bash
npm run test -- tests/ledger/manual
npm run prisma:validate
npm run db:status
npm run verify
```

Expected: all commands exit 0.

- [ ] Confirm all manual facts use `appendLedgerFacts()`.
- [ ] Confirm no manual service writes source tables directly.
- [ ] Confirm no manual balance edit API exists.
- [ ] Commit with message:

```text
ledger: implement manual fallback writes

Adds P2-5 external trade, attribution, reversal, and pending attribution services.
Generated by Codex.
```

## Acceptance Checklist

- [ ] External trade entry writes through `appendLedgerFacts()`.
- [ ] Attribution writes through `appendLedgerFacts()`.
- [ ] Reversal writes through `appendLedgerFacts()`.
- [ ] Direct balance edits are impossible.
- [ ] Re-attribution is append-only.
- [ ] Reversal does not edit target facts.
- [ ] Pending attribution query is read-only.
- [ ] Manual official-runtime facts use `source_mode = "live"` with manual origin/trigger.
- [ ] Local imported copies remain `remote_import`.
- [ ] `npm run verify` exits 0.
