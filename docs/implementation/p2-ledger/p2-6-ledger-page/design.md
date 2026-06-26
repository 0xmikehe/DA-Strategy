# P2-6 Ledger Page Design

## Goal

Build the user-facing ledger page for account facts, sync freshness, reconciliation, pending attribution, read-only ledger flows, external trade entry, and binding/key health visibility.

P2-6 is a page and BFF/read-model phase. It must not become a second ledger writer. Every page write action delegates to P2-3 or P2-5 services, which in turn write facts through `appendLedgerFacts()`.

## Prerequisites

P2-6 depends on:

- P2-0 ingest kernel.
- P2-1 mock/cassette data for offline page states.
- P2-3 live sync service for explicit manual sync action.
- P2-4 replay/reconciliation services for computed state and result history.
- P2-5 manual fallback services for attribution, external trade entry, and reversal.
- Visual contract `design/数字资产投资操作系统_视觉说明.html` and ADR-0002.

## Page Principles

- Problem states come first: sync failure, stale data, reconciliation differences, and pending attribution.
- Source mode is always visible for displayed facts: `fixture`, `mock`, `cassette`, `remote_import`, or `live`.
- Write surface is intentionally small.
- No manual balance edit exists.
- Sensitive account data stays on the ledger page and is not emitted to site activity, notifications, or logs.
- Page actions are commands, not direct database writes.

## Page Information Architecture

Module order:

1. Sync and freshness bar.
2. Reconciliation panel.
3. Pending attribution queue.
4. Ledger flow table.
5. External trade entry.
6. Binding and key health panel.

This matches the ledger PRD priority: status and correctness before browsing history.

## Components

### Sync and Freshness Bar

Shows:

- latest successful sync time by account/endpoint group.
- latest import time and package kind for local `remote_import`, `mock`, or `cassette` data.
- current source mode label.
- failed sync/import state and safe error reason.
- explicit "sync now" action when live runtime is configured.

States:

| State | Meaning |
| --- | --- |
| `ok` | latest successful sync/import is fresh |
| `stale` | data exceeded freshness threshold |
| `fail` | latest run failed |
| `load` | sync/import/reconciliation is running |
| `empty` | no ledger data yet |

Local imported data must say `remote_import`, not `live`.

### Reconciliation Panel

Shows latest P2-4 results:

- account.
- asset.
- computed quantity.
- reported quantity.
- diff with explicit sign.
- threshold.
- status.
- checked time.
- snapshot reference.
- diagnostics and likely next action.

Status mapping:

| Reconciliation status | UI label |
| --- | --- |
| `MATCHED` | balanced / good |
| `MISSING_EVENT` | missing event / risk |
| `EXTERNAL_BALANCE_MISMATCH` | external mismatch / risk |
| `NEEDS_CLASSIFICATION` | needs classification / todo |

Actions from this panel do not edit balances. They navigate to resync, attribution, external trade entry, or reversal command flows.

### Pending Attribution Queue

Shows P2-5 pending attribution items:

- target fact.
- account.
- asset/quantity.
- source mode.
- origin.
- occurred time.
- suggested reason.
- current effective attribution if any.

Only attribution state `pending` appears in this queue. Items that are `strategy_assigned`, `external_assigned`, `unassigned_terminal`, or `reversed` belong in history/read-only filters, not in the pending queue.

Actions:

- assign to strategy/version.
- mark external.
- mark unassigned, which creates an `unassigned_terminal` attribution and removes the item from pending.
- reverse target fact.
- batch attribution.

Each action calls P2-5 services. The page never inserts `attribution_record` or `ledger_reversal` directly.

### Ledger Flow Table

Read-only table for:

- `exchange_trade_fill`
- `exchange_order`
- `capital_flow_event`
- `external_trade`
- `attribution_record`
- `reversal`

Filters:

- account.
- asset.
- fact kind.
- source mode.
- origin kind.
- strategy.
- time range.
- reconciliation status link.

Rows show source mode and origin. Numeric values use signed symbols and tabular alignment; color is never the only signal.
Trade/fill rows show `snapshot_id` when present and link to the frozen market snapshot view. Missing `snapshot_id` is shown as an explicit empty state, not replaced by `snapshot_time`.

### External Trade Entry

Small form for P2-5 external trade commands:

- wallet account.
- side.
- base asset.
- quote asset.
- quantity.
- price or quote quantity.
- fee.
- occurred time.
- optional tx ID/venue/note.
- optional strategy attribution.

Submit action calls `submitManualExternalTrade()`.

The form never offers "adjust balance". Correction copy must guide users to reversal + replacement.

### Binding and Key Health Panel

Read-only panel:

- strategy/subaccount binding summary.
- last key health check.
- `OK`, `WARN`, or `BLOCK`.
- failed endpoint/account summaries.
- safe operator next action.

This panel does not capture API secrets and does not edit credentials in P2-6.

## BFF / Read Model Shape

P2-6 should expose one page-oriented read service:

```text
getLedgerPageModel()
```

Suggested sections:

- `freshness`
- `sourceSummary`
- `reconciliation`
- `pendingAttribution`
- `flows`
- `externalTradeFormOptions`
- `bindingHealth`
- `capabilities`

`capabilities` controls whether actions such as manual sync, attribution, reversal, and external trade entry are available in the current runtime.

Action endpoints/server actions:

- `requestLedgerSync()` -> P2-3 explicit sync service.
- `submitLedgerAttribution()` -> P2-5 attribution service.
- `submitLedgerExternalTrade()` -> P2-5 external trade service.
- `submitLedgerReversal()` -> P2-5 reversal service.
- `requestLedgerReconciliation()` -> P2-4 reconciliation service.

No BFF route or server action may call Prisma source table writes directly.

## Offline and Remote Modes

P2-6 must be useful locally before live runtime is available:

- `mock` package state for empty, healthy, pending attribution, and mismatch scenarios.
- `cassette` package state for regression.
- `remote_import` state for real remote exports pulled locally.

The UI must make these modes explicit. It must not present imported remote data as live.

## Visual Rules

Implementation must read the visual contract before coding the page:

- `design/数字资产投资操作系统_视觉说明.html`
- `docs/decisions/0002-visual-language-baseline.md`

Expected component vocabulary:

- `panel`
- `table`
- `badge`
- `pill`
- `btn`
- `tab`
- `empty`
- `load`

Desktop is primary. Mobile keeps critical state: sync status, reconciliation warnings, and pending attribution count.

## Failure Semantics

- Page model load failure shows a recoverable error state.
- Missing ledger data shows empty state, not fake zeros.
- Stale data is visible and does not silently become ok.
- Action failure returns safe, non-secret error text.
- P2-5 action success can still show reconciliation retry needed if P2-4 trigger fails.
- Live sync action is explicit and disabled when runtime lacks live capability.

## Boundaries

- P2-6 does not call Binance directly.
- P2-6 does not store or display API secrets.
- P2-6 does not write source facts directly.
- P2-6 does not expose a generic Binance proxy.
- P2-6 does not expose account facts to the signal layer.
- P2-6 does not make strategy decisions.

## Verification

- Page shows source mode labels for mock, cassette, remote import, and live data.
- Page distinguishes stale, fail, load, empty, and ok states.
- Reconciliation panel displays all four P2-4 statuses.
- Pending attribution actions call P2-5 services.
- External trade submit calls P2-5 service.
- No page/server action writes ledger source tables directly.
- No manual balance edit control exists.
- Visual implementation follows ADR-0002 and the visual contract.
- Frontend implementation runs `npm run build` and `npm run test:e2e` when page behavior is implemented.
