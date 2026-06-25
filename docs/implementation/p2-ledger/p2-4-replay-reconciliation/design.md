# P2-4 Replay and Reconciliation Design

## Goal

Turn append-only ledger source facts into computed account balances, strategy positions, lots, and reconciliation results.

P2-4 answers the ledger acceptance question: "is the account correct?" It does this by replaying facts as a pure function and comparing computed balances with reported `account_balance_snapshot` rows.

P2-4 does not create, edit, or repair source facts. When reconciliation finds a gap, it records the gap and points the operator toward P2-3 resync, P2-5 manual attribution, external trade entry, or reversal.

## Prerequisites

P2-4 depends on:

- P2-0 ingest kernel and append-only source fact tables.
- P2-1 mock/import/cassette paths for deterministic offline replay fixtures.
- P2-3 live sync producing `exchange_trade_fill`, `capital_flow_event`, `external_trade`, `attribution_record`, `reversal`, and `account_balance_snapshot` facts.
- Ledger PRD replay principle: balances, positions, lots, cost, and PnL are derived from the event stream.

## Core Rule

Source facts remain the only truth.

```text
source facts
  -> replayLedgerFacts(events, asOf)
  -> computed balances / positions / lots
  -> reconcile(computed, reported snapshots)
  -> append reconciliation_result
```

The replay output may be returned directly to callers. P2-4 should not introduce persistent balance, position, or lot source tables. Any later cache or materialized projection must be explicitly justified as a performance optimization and must be rebuildable from source facts.

## Components

### Event Reader

The event reader loads account facts for a bounded replay:

- `exchange_trade_fill`
- `capital_flow_event`
- `external_trade`
- `attribution_record`
- `reversal`
- `account_balance_snapshot`

Reader rules:

- Read source facts only.
- Sort by `occurred_at`, then deterministic tiebreakers such as source kind, exchange ID, local ID, and idempotency key.
- Preserve decimal strings until arithmetic helpers consume them.
- Resolve reversal facts without mutating the target row.
- Support `asOf` replay for historical inspection.

### Canonical Replay Events

The reader maps source rows into a smaller replay vocabulary:

| Replay event | Source rows | Accounting effect |
| --- | --- | --- |
| `trade_fill` | `exchange_trade_fill` | base/quote quantity changes, fee, lot open/close |
| `capital_flow` | `capital_flow_event` | deposit, withdrawal, transfer, convert, dust, dividend, wallet movement |
| `external_trade` | `external_trade` | external wallet position and cost-basis effect |
| `attribution` | `attribution_record` | strategy ownership version, no account balance change |
| `reversal` | `ledger_reversal` | cancels the accounting effect of the target fact |

The canonical layer keeps exchange-specific quirks out of the replay engine.

### Replay Engine

`replayLedgerFacts(events, options)` is a deterministic pure function.

Outputs:

- `account_balances`: account x asset computed totals.
- `strategy_positions`: strategy x asset computed totals, including quote-asset cash legs.
- `lots`: remaining lots for assets that need cost basis.
- `realized_pnl`: realized PnL by strategy, asset, and quote asset where supported.
- `unassigned`: account/asset quantities that cannot yet be attributed.
- `diagnostics`: invalid ordering, orphan attribution, reversed missing target, negative-balance warnings, and unsupported event warnings.

Replay rules:

- Financial values use decimal-safe arithmetic; JS `number` is not accepted for money or quantity.
- Duplicate source facts are already handled by P2-0 idempotency, but replay must still be stable if duplicate rows appear in a fixture.
- A reversal cancels the target fact effect from replay output; it does not delete target evidence.
- Attribution affects strategy projection, not account balances.
- External wallet events affect external wallet balances and strategy positions when attributed.
- Phase 1 lot accounting uses FIFO unless a later ADR explicitly changes the cost-basis policy.

### Conservation Checks

Replay produces invariant checks:

```text
sum(account computed balance by asset)
  = sum(strategy position by asset) + master/unassigned by asset
```

Invariant failures become replay diagnostics and surface on the ledger page. They are not auto-fixed.

### Reconciliation Service

The reconciliation service compares computed balances with reported snapshots:

```text
computed = replay.account_balances[account][asset]
reported = account_balance_snapshot.free + locked
diff = computed - reported
```

Status classification:

| Status | Rule |
| --- | --- |
| `MATCHED` | `abs(diff) <= threshold` |
| `MISSING_EVENT` | `reported > computed` beyond threshold |
| `EXTERNAL_BALANCE_MISMATCH` | `computed > reported` beyond threshold |
| `NEEDS_CLASSIFICATION` | Difference matches unsupported or unclassified event diagnostics |

Thresholds are asset-aware. Initial implementation may use configured per-asset precision, with a conservative default until exchange precision is available.

### Result Writer

`reconciliation_result` is an append-only audit/result record, not a source balance.

Minimum fields:

- `run_id`
- `account_id`
- `asset`
- `computed_qty`
- `reported_qty`
- `diff_qty`
- `threshold_qty`
- `status`
- `snapshot_ref`
- `checked_at`
- `note`
- `diagnostics`

Result writes are owned by the reconciliation service. They must not write or update ledger source fact tables, and they must not advance sync cursors.

### Trigger Points

P2-4 can run after:

- successful P2-1 package import.
- successful P2-3 sync batch.
- manual operator reconciliation command.
- P2-5 manual external trade, attribution, or reversal command.

Triggering replay never implies automatic fact repair.

## Data Flow

```text
ingest result / manual command / operator CLI
  -> load source facts and latest reported snapshots
  -> normalize into replay events
  -> replayLedgerFacts(events, asOf)
  -> run conservation checks
  -> compare computed balances with reported snapshots
  -> append reconciliation_result records
  -> expose latest run to P2-6 ledger page
```

## Failure Semantics

- Missing required source fields fail the replay run and produce a safe diagnostic.
- Unsupported event kind fails closed unless explicitly marked as non-accounting metadata.
- Missing reported snapshot means reconciliation status is unavailable for that account/asset, not `MATCHED`.
- Reversal targeting a missing fact produces a diagnostic and no accounting effect.
- Reconciliation result write failure does not mutate source facts.
- A failed reconciliation run must not advance sync cursors.

## Boundaries

- P2-4 does not call Binance.
- P2-4 does not create account facts to fix mismatches.
- P2-4 does not expose account data to the signal layer.
- P2-4 does not generate strategy decisions.
- P2-4 does not allow manual balance edits.
- P2-4 writes only replay/reconciliation audit state; source-fact changes still belong to P2-0/P2-5.

## Verification

- Same source facts and `asOf` produce the same replay output.
- Re-importing the same mock/cassette package does not change replay output.
- Buy, sell, fee, deposit, withdrawal, transfer, external trade, attribution, and reversal fixtures replay deterministically.
- FIFO lot behavior is covered by partial-sell tests.
- Computed vs reported matching produces `MATCHED`.
- Reported greater than computed produces `MISSING_EVENT`.
- Computed greater than reported produces `EXTERNAL_BALANCE_MISMATCH`.
- Unsupported/unclassified accounting effects can produce `NEEDS_CLASSIFICATION`.
- Reconciliation results are append-only.
- No P2-4 service writes source fact tables or sync cursors.
