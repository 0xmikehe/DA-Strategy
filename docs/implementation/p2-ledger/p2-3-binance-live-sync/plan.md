# P2-3 Binance Live Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build explicit opt-in remote Binance live sync, including account binding/key-health baseline services and automatic physical-subaccount attribution, then submit normalized account facts through `appendLedgerFacts()` with `source_mode = "live"`.

**Architecture:** P2-3 adds account/credential/binding models, remote-only credential resolution, key health checks, signed Binance client wrappers, rate-limit/retry policy, endpoint workers, attribution enrichment, normalizers, and live sync orchestration. Binding and credential lifecycle state is control-plane/account-configuration state; account source facts and fact-related cursor advancements commit through P2-0 in one transaction.

**Tech Stack:** TypeScript, Prisma, Zod, Node CLI via `tsx`, Vitest with mocked Binance HTTP responses, explicit remote runtime environment variables.

---

## Required Reading

- `docs/implementation/p2-ledger/p2-3-binance-live-sync/design.md`
- `docs/prd/账本层PRD_v0.1.md` sections 2 and 3
- `docs/decisions/0003-ledger-account-model-and-sync-architecture.md`
- `docs/implementation/p2-ledger/p2-0-ingest-kernel/design.md`
- `docs/implementation/p2-ledger/p2-2-remote-exporter/design.md`

## File Structure

- Modify `prisma/schema.prisma`: add credential, key health, and account binding baseline models if not already present.
- Create `prisma/migrations/20260625110000_p2_binance_live_sync/migration.sql`.
- Create `src/ledger/binance/types.ts`.
- Create `src/ledger/binance/credentials.ts`.
- Create `src/ledger/binance/key-health.ts`.
- Create `src/ledger/binance/bindings.ts`.
- Create `src/ledger/binance/attribution.ts`.
- Create `src/ledger/binance/client.ts`.
- Create `src/ledger/binance/rate-limit.ts`.
- Create `src/ledger/binance/normalizers.ts`.
- Create `src/ledger/binance/sync-service.ts`.
- Create `src/ledger/binance/cli.ts`.
- Modify `package.json`: add explicit live scripts.
- Create `tests/ledger/binance/key-health.test.ts`.
- Create `tests/ledger/binance/bindings.test.ts`.
- Create `tests/ledger/binance/attribution.test.ts`.
- Create `tests/ledger/binance/normalizers.test.ts`.
- Create `tests/ledger/binance/sync-service.test.ts`.
- Create `tests/ledger/binance/live-boundary.test.ts`.

## Task 1: Credential and Key Health Baseline

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260625110000_p2_binance_live_sync/migration.sql`
- Create: `src/ledger/binance/types.ts`
- Create: `src/ledger/binance/credentials.ts`
- Create: `src/ledger/binance/key-health.ts`
- Create: `tests/ledger/binance/key-health.test.ts`

- [ ] **Step 1: Write failing key health tests**

Test:

- read-only enabled and no trading/withdrawal permissions passes.
- withdrawal permission blocks.
- spot/margin trading permission blocks.
- no IP restriction produces warn, not block.
- credential resolver returns env var names but never logs secret values.

Run:

```bash
npm run test -- tests/ledger/binance/key-health.test.ts
```

Expected: FAIL because Binance modules do not exist.

- [ ] **Step 2: Add minimal Prisma models**

Add models only if P2-0/P2-1/P2-2 have not already added them:

- `ExchangeAccount`
- `ApiCredential`
- `ApiKeyHealthCheck`
- `AccountBindingAudit`

Keep secret material out of DB. Store `keyRef`, not key values.

Minimum ownership:

- `ExchangeAccount`: exchange, account role, subaccount identifiers, safe label, active/frozen status, optional current bound strategy summary.
- `ApiCredential`: exchange account, `keyRef`, safe permission summary, status, no key values.
- `ApiKeyHealthCheck`: append-only health result, reason codes, checked time, safe endpoint/account scope.
- `AccountBindingAudit`: append-only binding window and lifecycle event for strategy/account/key bind, unbind, key rotation, and block.

These models are not account source facts and do not use `appendLedgerFacts()`.

- [ ] **Step 3: Generate migration**

Run:

```bash
npm run db:migrate -- --name p2_binance_live_sync
```

Expected: migration created. Rename directory to `20260625110000_p2_binance_live_sync` before commit if needed.

- [ ] **Step 4: Implement credential resolver and health evaluator**

`resolveBinanceCredential(keyRef)`:

- reads `${keyRef}_API_KEY`,
- reads `${keyRef}_API_SECRET`,
- returns values only to the Binance client,
- throws safe errors when missing.

`evaluateKeyHealth(apiRestrictions)` returns `OK`, `WARN`, or `BLOCK` with reason codes.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- tests/ledger/binance/key-health.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 2: Binding Windows and Automatic Attribution

**Files:**
- Create: `src/ledger/binance/bindings.ts`
- Create: `src/ledger/binance/attribution.ts`
- Create: `tests/ledger/binance/bindings.test.ts`
- Create: `tests/ledger/binance/attribution.test.ts`

- [ ] **Step 1: Write failing binding and attribution tests**

Test:

- active binding lookup returns the strategy/account/key window effective at an event timestamp.
- unbound or blocked account returns a safe unresolved result, not a guessed strategy.
- exchange-internal trade fill dimensions include `exchange_account_id`, `symbol`, `base_asset`, `quote_asset`, `asset`, `strategy_id`, `strategy_version`, and `snapshot_id` when a snapshot resolver returns one.
- missing snapshot resolver result leaves `snapshot_id` absent and records a diagnostic.
- automatic attribution never reads or exposes API key values.

Run:

```bash
npm run test -- tests/ledger/binance/bindings.test.ts tests/ledger/binance/attribution.test.ts
```

Expected: FAIL until binding and attribution services exist.

- [ ] **Step 2: Implement binding lookup**

`resolveActiveBinding({ exchangeAccountId, at })` reads binding/account/key state and returns:

```ts
type ActiveAccountBinding = {
  exchange_account_id: string;
  api_credential_id: string;
  key_ref: string;
  strategy_id?: string;
  strategy_version?: string;
  binding_state: "active" | "unbound" | "blocked";
  blocking_reasons: string[];
};
```

The service must resolve by event time, not by current time only.

- [ ] **Step 3: Implement attribution enrichment**

`enrichFactDimensions({ fact, binding, snapshotResolver })` returns a fact command with typed `dimensions` populated from normalized payload and binding state.

Rules:

- bound exchange-internal facts get `strategy_id` and `strategy_version`.
- unbound/blocked facts do not guess attribution and return a pending-attribution diagnostic.
- `snapshot_id` is copied only from the snapshot resolver result.
- `snapshot_time` remains reserved for `account_balance_snapshot` natural keys and must not be used as a substitute for `snapshot_id`.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/binance/bindings.test.ts tests/ledger/binance/attribution.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 3: Binance Client and Rate Policy

**Files:**
- Create: `src/ledger/binance/client.ts`
- Create: `src/ledger/binance/rate-limit.ts`
- Extend: `tests/ledger/binance/key-health.test.ts` or create client-focused tests.

- [ ] **Step 1: Write failing client tests with mocked transport**

Test:

- client signs USER_DATA requests through injected signer/transport.
- safe request metadata excludes API secret, signature, headers, and signed URL.
- rate policy backs off on mocked `429`.
- timestamp drift error can trigger server-time correction path.

Run:

```bash
npm run test -- tests/ledger/binance/key-health.test.ts
```

Expected: FAIL until client/rate policy exists.

- [ ] **Step 2: Implement client with injected transport**

Initial client must support mocked tests without network. The live transport is only used by explicit CLI commands.

Do not add Binance calls to default tests or `npm run verify`.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/binance/key-health.test.ts
npm run typecheck
```

Expected: both commands exit 0 without network.

## Task 4: Normalizers

**Files:**
- Create: `src/ledger/binance/normalizers.ts`
- Create: `tests/ledger/binance/normalizers.test.ts`

- [ ] **Step 1: Write failing normalizer tests**

Use mocked Binance payloads for:

- `myTrades` -> `exchange_trade_fill`
- `allOrders` -> `exchange_order`
- balance response -> `account_balance_snapshot`
- transfer/deposit/withdraw/convert/dust/dividend -> `capital_flow_event`

Assert:

- all financial values are strings.
- origin is `binance_user_data`.
- source mode is not assigned by normalizer; sync service assigns batch `source_mode = "live"`.
- idempotency keys follow ledger PRD natural keys.
- normalized facts include typed dimensions needed by P2-0/P2-4/P2-6: account, asset/base/quote, symbol, external ID where present, and attribution fields after enrichment.

Run:

```bash
npm run test -- tests/ledger/binance/normalizers.test.ts
```

Expected: FAIL until normalizers exist.

- [ ] **Step 2: Implement normalizers**

Each normalizer returns `LedgerFactCommand[]` and endpoint-specific cursor hints. It does not write DB and does not call `appendLedgerFacts()` directly.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/binance/normalizers.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 5: Sync Service and Cursor Atomicity

**Files:**
- Create: `src/ledger/binance/sync-service.ts`
- Create: `tests/ledger/binance/sync-service.test.ts`

- [ ] **Step 1: Write failing sync service tests**

Test with mocked client:

- successful endpoint window calls `appendLedgerFacts()` with `source_mode = "live"`.
- cursor advancement is included in the same ingest command.
- empty successful window submits empty facts with cursor advancement.
- parse failure does not call `appendLedgerFacts()`.
- unsafe key health blocks sync before Binance call.
- duplicate window is idempotent through P2-0.

Run:

```bash
npm run test -- tests/ledger/binance/sync-service.test.ts
```

Expected: FAIL until sync service exists.

- [ ] **Step 2: Implement sync service**

`runLedgerLiveSync(workItem)`:

1. resolve binding and credential,
2. check key health,
3. call endpoint worker,
4. normalize records,
5. build `LedgerIngestCommand`,
6. call `appendLedgerFacts()`,
7. return safe summary.

No direct source-table Prisma writes.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/binance/sync-service.test.ts
npm run typecheck
```

Expected: both commands exit 0 without network.

## Task 6: Explicit Live CLI and Boundary Tests

**Files:**
- Create: `src/ledger/binance/cli.ts`
- Modify: `package.json`
- Create: `tests/ledger/binance/live-boundary.test.ts`

- [ ] **Step 1: Add boundary tests**

Test:

- `npm run verify` script does not include live scripts.
- live scripts are named explicitly.
- no `src/app/api/binance` proxy exists.
- Binance client secret-like strings are not included in safe summaries.

Run:

```bash
npm run test -- tests/ledger/binance/live-boundary.test.ts
```

Expected: FAIL until scripts and boundary helpers exist.

- [ ] **Step 2: Add explicit scripts**

Add:

```json
{
  "ledger:live-smoke": "node --import tsx src/ledger/binance/cli.ts live-smoke",
  "ledger:sync": "node --import tsx src/ledger/binance/cli.ts sync"
}
```

Do not include these scripts in `verify`.

- [ ] **Step 3: Implement CLI guards**

CLI must require explicit args:

```text
npm run ledger:live-smoke
npm run ledger:sync -- --account acct_1 --endpoint spot_my_trades --symbol BTCUSDT
npm run ledger:sync -- --all-active
```

If required remote env vars are missing, fail with a safe message.

- [ ] **Step 4: Run boundary tests**

Run:

```bash
npm run test -- tests/ledger/binance/live-boundary.test.ts
npm run typecheck
```

Expected: both commands exit 0 without network.

## Task 7: Manual Live Smoke Procedure

**Files:**
- Create or update: `docs/implementation/p2-ledger/p2-3-binance-live-sync/live-smoke.md`

- [ ] **Step 1: Document remote-only smoke**

Include:

- required env vars,
- read-only key requirement,
- no trading/no withdrawal permission check,
- exact command,
- expected safe output shape,
- rollback/no-op explanation.

- [ ] **Step 2: Do not run live smoke locally**

Live smoke requires human explicit remote execution. Local implementation verification stops at mocked tests and `npm run verify`.

## Task 8: Final Verification

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- tests/ledger/binance/key-health.test.ts tests/ledger/binance/normalizers.test.ts tests/ledger/binance/sync-service.test.ts tests/ledger/binance/live-boundary.test.ts
npm run typecheck
npm run prisma:validate
npm run db:status
```

Expected: all commands exit 0 and make no live network calls.

- [ ] **Step 2: Run aggregate gate**

Run:

```bash
npm run verify
```

Expected: exits 0 and makes no live Binance calls.

## Acceptance Checklist

- Live sync is explicit opt-in.
- Credentials are resolved only from remote env by `key_ref`.
- Unsafe key permissions block sync.
- Binance client does not leak signed request material.
- Normalizers produce P2-0 fact commands.
- Sync service calls `appendLedgerFacts()` for facts and cursor advancement.
- Failed batches do not advance cursor.
- No transparent Binance proxy exists.
- Default verification remains offline.
