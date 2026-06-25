# P2-6 Ledger Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ledger page and page-facing services that display source mode, freshness, reconciliation, pending attribution, ledger flows, external trade entry, and binding/key health while delegating every write action to P2-3 or P2-5 services.

**Architecture:** P2-6 adds a page read model, BFF/server actions, UI components following the visual contract, mock/cassette state fixtures, and Playwright coverage. The page can read ledger services and submit commands, but it never writes ledger source facts directly.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma read services, existing CSS/design tokens, Vitest for read model/actions, Playwright for user-facing flow tests.

---

## Required Reading

- `AGENTS.md`
- `design/数字资产投资操作系统_视觉说明.html`
- `docs/decisions/0002-visual-language-baseline.md`
- `docs/prd/账本层PRD_v0.1.md` section 8
- `docs/implementation/p2-ledger/p2-6-ledger-page/design.md`
- `docs/implementation/p2-ledger/p2-4-replay-reconciliation/design.md`
- `docs/implementation/p2-ledger/p2-5-manual-fallback-writes/design.md`

## File Structure

- Create `src/ledger/page-model/types.ts`.
- Create `src/ledger/page-model/get-ledger-page-model.ts`.
- Create `src/ledger/page-model/formatters.ts`.
- Create `src/app/ledger/page.tsx`.
- Create `src/app/ledger/actions.ts`.
- Create `src/app/ledger/components/sync-freshness-bar.tsx`.
- Create `src/app/ledger/components/reconciliation-panel.tsx`.
- Create `src/app/ledger/components/pending-attribution-queue.tsx`.
- Create `src/app/ledger/components/ledger-flow-table.tsx`.
- Create `src/app/ledger/components/external-trade-entry.tsx`.
- Create `src/app/ledger/components/binding-health-panel.tsx`.
- Create `src/app/ledger/components/source-mode-badge.tsx`.
- Create `tests/ledger/page-model/get-ledger-page-model.test.ts`.
- Create `tests/ledger/page-actions/boundary.test.ts`.
- Create `tests/e2e/p2-ledger-page.spec.ts`.
- Modify navigation/homepage as needed to link to `/ledger`.
- Modify `src/app/globals.css` only if existing tokens need small ledger-specific composition classes.

## Task 1: Page Model Contract

**Files:**
- Create: `src/ledger/page-model/types.ts`
- Create: `src/ledger/page-model/get-ledger-page-model.ts`
- Create: `src/ledger/page-model/formatters.ts`
- Create: `tests/ledger/page-model/get-ledger-page-model.test.ts`

- [ ] **Step 1: Write failing page model tests**

Test:

- model includes `freshness`, `sourceSummary`, `reconciliation`, `pendingAttribution`, `flows`, `externalTradeFormOptions`, `bindingHealth`, and `capabilities`.
- source modes are preserved as `fixture`, `mock`, `cassette`, `remote_import`, or `live`.
- missing data yields empty states, not fake zeros.
- stale/fail/load/ok states are representable.
- account-sensitive fields are not included in notification/activity payload helpers.

Run:

```bash
npm run test -- tests/ledger/page-model/get-ledger-page-model.test.ts
```

Expected: FAIL because page model does not exist.

- [ ] **Step 2: Implement model types and formatters**

Keep UI formatting helpers pure:

- signed decimal display.
- source mode labels.
- reconciliation status labels.
- freshness labels.

- [ ] **Step 3: Implement read model service**

Use ledger read services from P2-4/P2-5 where available. Stub with mock/cassette-friendly adapters only if implementation order requires it.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/ledger/page-model/get-ledger-page-model.test.ts
npm run typecheck
```

Expected: both commands exit 0.

## Task 2: Action Boundary

**Files:**
- Create: `src/app/ledger/actions.ts`
- Create: `tests/ledger/page-actions/boundary.test.ts`

- [ ] **Step 1: Write failing action boundary tests**

Test:

- `requestLedgerSync()` delegates to P2-3 sync service.
- `submitLedgerAttribution()` delegates to P2-5 attribution service.
- `submitLedgerExternalTrade()` delegates to P2-5 external trade service.
- `submitLedgerReversal()` delegates to P2-5 reversal service.
- `requestLedgerReconciliation()` delegates to P2-4 reconciliation service.
- actions do not call Prisma source fact create/update/delete methods.
- no action accepts manual balance adjustment.

Run:

```bash
npm run test -- tests/ledger/page-actions/boundary.test.ts
```

Expected: FAIL because actions do not exist.

- [ ] **Step 2: Implement server actions**

Actions return safe summaries and form errors. Do not return secrets, signed URLs, or full sensitive payloads.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/page-actions/boundary.test.ts
```

Expected: command exits 0.

## Task 3: Route and Layout Shell

**Files:**
- Create: `src/app/ledger/page.tsx`
- Create: `src/app/ledger/components/source-mode-badge.tsx`
- Modify: navigation/homepage if needed

- [ ] **Step 1: Create route**

Render the usable ledger page as the first screen. Do not build a marketing/intro page.

- [ ] **Step 2: Add source mode and state primitives**

Implement small display primitives:

- source mode badge.
- freshness pill.
- reconciliation badge.
- empty and loading states.

- [ ] **Step 3: Link page**

Add a route link only in existing navigation style. Avoid unrelated homepage redesign.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: command exits 0.

## Task 4: Sync and Reconciliation UI

**Files:**
- Create: `src/app/ledger/components/sync-freshness-bar.tsx`
- Create: `src/app/ledger/components/reconciliation-panel.tsx`
- Extend: `tests/e2e/p2-ledger-page.spec.ts`

- [ ] **Step 1: Implement sync/freshness bar**

Display:

- source mode.
- latest success.
- stale/fail/load/empty/ok.
- safe error reason.
- explicit sync button when capability exists.

- [ ] **Step 2: Implement reconciliation panel**

Display:

- all four reconciliation statuses.
- computed/reported/diff/threshold.
- snapshot reference.
- diagnostics and next action.

Do not include "adjust balance".

- [ ] **Step 3: Add e2e checks**

Test mocked page data for:

- source mode visible.
- stale/fail state visible.
- reconciliation difference visible with sign, not color alone.

Run:

```bash
npm run test:e2e -- tests/e2e/p2-ledger-page.spec.ts
```

Expected: command exits 0 once route and test harness are ready.

## Task 5: Pending Attribution and Manual Actions

**Files:**
- Create: `src/app/ledger/components/pending-attribution-queue.tsx`
- Create: `src/app/ledger/components/external-trade-entry.tsx`
- Extend: `tests/e2e/p2-ledger-page.spec.ts`

- [ ] **Step 1: Implement pending attribution queue**

Display target fact, account, asset, quantity, source mode, occurred time, and suggested reason.

Actions:

- assign to strategy/version.
- mark external.
- mark unassigned.
- reverse.
- batch attribute.

All actions call `src/app/ledger/actions.ts`.

- [ ] **Step 2: Implement external trade entry**

Use the P2-5 minimal field set. Client validation improves UX, but server action validation remains authoritative.

- [ ] **Step 3: Add e2e checks**

Test:

- pending item can open attribution action.
- external trade form submits to mocked action path.
- no manual balance edit control exists.

Run:

```bash
npm run test:e2e -- tests/e2e/p2-ledger-page.spec.ts
```

Expected: command exits 0.

## Task 6: Flow Table and Binding Health

**Files:**
- Create: `src/app/ledger/components/ledger-flow-table.tsx`
- Create: `src/app/ledger/components/binding-health-panel.tsx`
- Extend: page model tests and e2e tests

- [ ] **Step 1: Implement ledger flow table**

Read-only filters:

- account.
- asset.
- fact kind.
- source mode.
- origin kind.
- strategy.
- time range.

Rows must show source mode and origin.

- [ ] **Step 2: Implement binding/key health panel**

Read-only display:

- strategy/subaccount binding.
- latest key health.
- `OK`, `WARN`, `BLOCK`.
- safe next action.

No secret field or credential edit form.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -- tests/ledger/page-model/get-ledger-page-model.test.ts
npm run test:e2e -- tests/e2e/p2-ledger-page.spec.ts
```

Expected: both commands exit 0.

## Task 7: Visual and Responsive Verification

**Files:**
- Modify: `src/app/globals.css` only if needed
- Extend: `tests/e2e/p2-ledger-page.spec.ts`

- [ ] **Step 1: Visual contract pass**

Confirm implementation uses existing tokens/components from:

```text
design/数字资产投资操作系统_视觉说明.html
```

No new color system or large custom visual language.

- [ ] **Step 2: Desktop and mobile e2e**

Add e2e screenshots/checks for:

- desktop ledger page first viewport.
- mobile critical state view.
- no overlap/clipping for tables/actions.

Run:

```bash
npm run test:e2e -- tests/e2e/p2-ledger-page.spec.ts
```

Expected: command exits 0.

## Task 8: Final Verification

- [ ] Run:

```bash
npm run test -- tests/ledger/page-model tests/ledger/page-actions
npm run test:e2e -- tests/e2e/p2-ledger-page.spec.ts
npm run build
npm run verify
```

Expected: all commands exit 0.

- [ ] Confirm no page/action code writes ledger source facts directly.
- [ ] Confirm no secret-bearing fields are rendered.
- [ ] Confirm source mode labels are visible in all loaded scenarios.
- [ ] Confirm no manual balance edit exists.
- [ ] Commit with message:

```text
ledger: implement ledger page

Adds P2-6 ledger page, page model, action boundaries, and e2e coverage.
Generated by Codex.
```

## Acceptance Checklist

- [ ] `/ledger` renders a usable ledger page.
- [ ] Source mode, freshness, reconciliation, pending attribution, flows, external entry, and key health are visible.
- [ ] Page supports mock/cassette/remote_import states offline.
- [ ] Page actions delegate to P2-3/P2-5/P2-4 services.
- [ ] No page action writes ledger source tables directly.
- [ ] No manual balance edit control exists.
- [ ] Visual contract and ADR-0002 are followed.
- [ ] `npm run build`, targeted e2e, and `npm run verify` exit 0.
