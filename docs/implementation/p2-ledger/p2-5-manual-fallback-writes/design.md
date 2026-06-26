# P2-5 Manual Fallback Writes Design

## Goal

Provide safe manual fallback write flows for account facts that cannot be completed by automated sync alone.

P2-5 covers:

- external trade entry.
- attribution records.
- reversals.

Every manual fallback write is normalized into `LedgerIngestCommand` and submitted through `appendLedgerFacts()`. P2-5 does not allow manual balance edits.

## Prerequisites

P2-5 depends on:

- P2-0 ingest kernel and manual origin/trigger support.
- P2-4 replay/reconciliation diagnostics so operators know why a manual fallback is needed.
- Ledger PRD rules for external trades, pending attribution, and reversal-only correction.
- P2-6 ledger page, later, to provide the user-facing action surface.

## Write Boundary

P2-5 is the manual command layer. It validates human intent and produces ingest commands.

Allowed shape:

```text
page action / CLI / operator command
  -> validate manual command
  -> normalize to LedgerIngestCommand
  -> appendLedgerFacts()
  -> trigger replay/reconciliation
```

Forbidden shape:

```text
page action / controller
  -> direct insert/update external_trade / attribution_record / ledger_reversal
```

Also forbidden:

- direct balance adjustment.
- editing existing facts.
- deleting bad rows.
- changing historical attribution by update; re-attribution appends a newer `attribution_record`.

## Manual Command Types

### External Trade Entry

Represents an account-affecting trade outside Binance API coverage, such as external wallet swap, other exchange fill, or OTC trade.

Minimum command fields:

- `wallet_account_id`
- `side`
- `base_asset`
- `quote_asset`
- `base_qty`
- `price` or `quote_qty`
- `occurred_at`

Optional fields:

- `fee_qty`
- `fee_asset`
- `tx_id`
- `venue`
- `note`
- `strategy_id`
- `strategy_version`

Rules:

- Quantities, prices, and fees are decimal strings and must be positive.
- `occurred_at` cannot be in the future.
- Assets must exist in the asset dictionary.
- If strategy attribution is included, the service emits both `external_trade` and `attribution_record` in one ingest batch.
- If attribution is omitted, replay places the event in pending/unassigned state.

### Attribution Record

Represents human assignment of an existing event to a strategy/version, external bucket, or unassigned bucket.

Minimum command fields:

- `target_fact_kind`
- `target_fact_id` or `target_idempotency_key`
- `assignment_kind`
- `reason_code`
- `occurred_at`

Assignment kinds:

- `strategy`
- `external`
- `unassigned`

Attribution state vocabulary:

| State | Meaning | Pending queue? |
| --- | --- | --- |
| `pending` | replay-affecting fact has no effective attribution and still needs operator classification | yes |
| `strategy_assigned` | latest valid attribution points to strategy/version | no |
| `external_assigned` | latest valid attribution marks the event as external/non-strategy | no |
| `unassigned_terminal` | operator intentionally leaves the event in master/unallocated bucket | no |
| `reversed` | target fact's accounting effect is canceled by a valid reversal | no |

Rules:

- Attribution changes strategy projection only.
- Attribution does not change account balance.
- Re-attribution appends a new record. The latest valid attribution wins during replay.
- `assignment_kind = "unassigned"` means `unassigned_terminal`, not "still pending".
- Batch attribution is allowed only when every target is validated before ingest.

### Reversal

Represents correction by canceling the accounting effect of a prior fact.

Minimum command fields:

- `target_fact_kind`
- `target_fact_id` or `target_idempotency_key`
- `reason_code`
- `note`
- `occurred_at`

Rules:

- Reversal appends `ledger_reversal`.
- Reversal does not update or delete the target fact.
- A replacement fact, if needed, is a separate fact in the same or follow-up ingest batch.
- Reversing a reversal is not allowed in the initial implementation; use a new explicit replacement command if needed.

## Source Mode and Metadata

Manual writes in the official runtime use:

- `source_mode = "live"`
- `origin.kind = "manual_external_trade"`, `manual_attribution`, or `manual_reversal`
- `trigger.kind = "manual_entry"`, `manual_attribution`, or `manual_reversal`
- `actor.kind = "user"` or `agent`

When exported and imported locally, those same facts enter the local database with `source_mode = "remote_import"` while preserving original manual origin/trigger metadata.

Mock and cassette manual-like facts use `source_mode = "mock"` or `cassette`; they must not look live.

## Validation Services

P2-5 provides validation before ingest:

- asset validation.
- account validation.
- target fact existence validation.
- target fact reversal eligibility validation.
- strategy/version validation for attribution.
- decimal string validation.
- actor/request metadata validation.
- idempotency key construction.

Validation failure happens before `appendLedgerFacts()`.

## Pending Attribution Query

P2-5 exposes a read service for P2-6:

```text
getPendingAttributionItems(filters)
```

The query is read-only. It finds facts that affect replay and are in attribution state `pending`.

Initial sources:

- external trades without strategy attribution.
- reconciliation diagnostics that point to attribution ambiguity.
- imported/manual facts that explicitly carry a pending classification marker.

The query does not write "pending" marker rows unless later implementation proves that a materialized queue is needed.
Facts marked `unassigned_terminal`, `external_assigned`, `strategy_assigned`, or `reversed` must not appear in the pending attribution queue.

## Triggering Replay

After successful manual ingest:

```text
appendLedgerFacts()
  -> P2-4 replay/reconciliation trigger
  -> latest reconciliation and pending attribution read models update
```

If replay/reconciliation fails after the manual fact is committed, the manual fact remains. The failure is operational state and can be retried.

## Failure Semantics

- Invalid command fails before ingest.
- Missing target fact fails before ingest for attribution and reversal.
- Batch attribution validates all targets before any fact is appended.
- Duplicate command idempotency returns a safe duplicate result through P2-0.
- Same idempotency key with changed payload fails as conflict.
- Replay failure after manual ingest does not roll back committed source facts.
- Manual commands never log secrets or account-sensitive details outside the ledger page/operator logs.

## Boundaries

- P2-5 does not call Binance.
- P2-5 does not write source tables directly.
- P2-5 does not update balances.
- P2-5 does not change key bindings or credential health.
- P2-5 does not export packages.
- P2-5 does not decide strategy recommendations; it only records attribution facts.

## Verification

- External trade entry produces an `external_trade` fact through `appendLedgerFacts()`.
- External trade with strategy attribution produces `external_trade` and `attribution_record` in one batch.
- Attribution produces an `attribution_record` and does not change account balance.
- Re-attribution appends a new record; old records remain.
- Reversal produces `ledger_reversal` and does not edit/delete target facts.
- Direct manual balance edits are impossible through public P2-5 APIs.
- Page/controller actions can call only P2-5 command services, not Prisma source-table writes.
- Manual official-runtime facts use `source_mode = "live"` with manual origin/trigger metadata.
