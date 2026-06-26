# P2-0 Ledger Ingest Kernel Design

## Goal

Create one ledger fact write boundary, named `appendLedgerFacts()`.

Every path that changes ledger account facts submits normalized ledger ingest commands to this service. No collector, importer, controller, page action, fixture helper, mock service, or worker writes ledger source tables directly.

This design turns the P2 rule from PRD/ADR language into an implementation contract. It is still a design document: table names and exact Prisma schema are finalized in the P2-0 implementation plan.

## Scope Boundary

`appendLedgerFacts()` owns account-fact ingestion and the ingest-consistency state that must be committed with those facts.

It owns writes for:

- `exchange_trade_fill`
- `exchange_order`
- `capital_flow_event`
- `external_trade`
- `attribution_record`
- `reversal`
- `account_balance_snapshot`
- ingest batch/import batch metadata
- sync cursor advancement when a sync batch is committed

It may later accept other account source facts if the P2 implementation plan explicitly adds them.

It does not own unrelated control-plane lifecycle writes such as creating queued jobs, registering credentials, editing exchange account labels, or updating UI preferences. Those services must not write ledger source facts. When they need to append ledger facts or advance a ledger cursor, they call `appendLedgerFacts()`.

It also does not own derived audit/result rows by default. For example, `reconciliation_result` is append-only audit state written by the reconciliation service, not an account source fact written by the ingest kernel, unless a later ADR explicitly changes the ingest command contract.

This distinction avoids two bad outcomes:

- A second fact writer hidden in a controller, importer, or worker.
- A false rule that every non-fact operational update in the system must pass through the ledger ingest kernel.
- A false rule that derived read/reconciliation state is account truth.

## Responsibilities

`appendLedgerFacts()` owns:

- Source mode validation.
- Fact origin validation.
- Actor and trigger metadata validation.
- Package metadata validation when source mode is `remote_import`, `mock`, or `cassette`.
- Import metadata validation when source mode is `remote_import`.
- Sync metadata validation when source mode is `live`.
- Batch idempotency keys.
- Fact-level idempotency keys across ledger source tables.
- Append-only semantics.
- Reversal semantics.
- Import batch metadata.
- Sync cursor advancement when supplied by a successful sync batch.
- Write summaries for downstream replay, reconciliation, and read model refresh.

It accepts commands for:

- Live Binance sync.
- Remote import packages.
- Fixture/cassette seed data.
- Manual external trade entry.
- Manual attribution.
- Reversals.

## Non-Responsibilities

`appendLedgerFacts()` does not:

- Call Binance.
- Export packages.
- Render pages.
- Calculate strategy actions.
- Evaluate market signals.
- Create or store API secrets.
- Expose a Binance-compatible API.
- Decide which Binance endpoint to poll.
- Decide strategy attribution rules beyond applying an explicit attribution command.

## Allowed Shape

```text
adapter/controller/worker/importer
  -> validate external/input shape
  -> normalize to ledger ingest command
  -> appendLedgerFacts()
  -> replay/reconciliation/read model
```

For live sync, cursor advancement is part of the same ingest transaction:

```text
ledger worker
  -> call Binance USER_DATA endpoint
  -> normalize page + next cursor
  -> appendLedgerFacts({ facts, cursorAdvancements })
  -> committed facts + committed cursor
```

## Forbidden Shape

```text
adapter/controller/worker/importer
  -> direct insert/update into ledger source tables
```

Also forbidden:

```text
adapter/controller/worker/importer
  -> insert facts
  -> separately update sync cursor
```

That shape can lose facts or skip windows if the process fails between the two writes.

## Source Modes, Origins, Actors, and Triggers

`source_mode` is the ingest environment/transport label. It answers "which lane brought this fact into this database?"

```ts
type LedgerDataSourceMode =
  | "fixture"
  | "mock"
  | "cassette"
  | "remote_import"
  | "live";
```

Manual writes do not require a separate `source_mode`. A manual external trade in the official runtime uses `source_mode = "live"` with `origin.kind = "manual_external_trade"` and `trigger.kind = "manual_entry"`. If that fact is exported and imported locally, the local database receives it as `source_mode = "remote_import"` while retaining `origin.original_source_mode = "live"`.

`origin` answers "what real-world or generated thing does this fact represent?"

```ts
type LedgerFactOrigin =
  | { kind: "binance_user_data"; endpoint: string; original_source_mode?: LedgerDataSourceMode }
  | { kind: "remote_export"; export_run_id: string; original_source_mode?: LedgerDataSourceMode }
  | { kind: "mock_scenario"; scenario_id: string }
  | { kind: "cassette"; cassette_id: string }
  | { kind: "fixture"; fixture_id: string }
  | { kind: "manual_external_trade" }
  | { kind: "manual_attribution" }
  | { kind: "manual_reversal" };
```

`actor` answers "who or what caused this ingest?"

```ts
type LedgerIngestActor =
  | { kind: "system"; name: "ledger-worker" | "mock-ledger-service" | "fixture-seed" | "cassette-seed" }
  | { kind: "user"; user_id: string }
  | { kind: "agent"; agent_id: string }
  | { kind: "import_tool"; name: string };
```

`trigger` answers "why did it run now?"

```ts
type LedgerIngestTrigger =
  | { kind: "scheduled_sync"; job_run_id: string }
  | { kind: "manual_sync"; job_run_id: string; requested_by: string }
  | { kind: "remote_import"; import_run_id: string }
  | { kind: "mock_generation"; scenario_id: string }
  | { kind: "cassette_seed"; cassette_id: string }
  | { kind: "fixture_seed"; fixture_id: string }
  | { kind: "manual_entry"; request_id: string }
  | { kind: "manual_attribution"; request_id: string }
  | { kind: "manual_reversal"; request_id: string };
```

## Command Shape

P2-0 should implement one public service method:

```ts
type AppendLedgerFacts = (
  command: LedgerIngestCommand
) => Promise<LedgerIngestResult>;
```

Initial command contract:

```ts
type LedgerIngestCommand = {
  batch: LedgerIngestBatch;
  facts: LedgerFactCommand[];
  cursor_advancements?: LedgerCursorAdvancement[];
};

type LedgerIngestBatch = {
  idempotency_key: string;
  source_mode: LedgerDataSourceMode;
  default_origin?: LedgerFactOrigin;
  actor: LedgerIngestActor;
  trigger: LedgerIngestTrigger;
  requested_at: string;
  package_metadata?: LedgerPackageMetadata;
  import_metadata?: LedgerImportMetadata;
  sync_metadata?: LedgerSyncMetadata;
};
```

Rules:

- `facts` may be empty only for a sync batch that advances a cursor after an empty source window, or for an explicit health/no-op batch defined in the implementation plan. The default is at least one fact.
- `requested_at` is an ISO 8601 UTC string.
- Amounts, prices, quantities, and fees are decimal strings. No command accepts JS `number` for financial values.
- The common typed replay/query dimensions listed below are explicit contract fields. Raw `payload` remains evidence, not the only replay/page contract.
- `source_mode = "remote_import"` requires `package_metadata` and `import_metadata`.
- `source_mode = "mock"` requires `default_origin.kind = "mock_scenario"` or every fact to provide `origin.kind = "mock_scenario"`; it also requires `package_metadata` from the local generated package.
- `source_mode = "cassette"` requires `default_origin.kind = "cassette"` or every fact to provide `origin.kind = "cassette"`; it also requires immutable cassette identity and `package_metadata`.
- `source_mode = "live"` requires `sync_metadata` for Binance-derived facts. Manual live facts require manual actor/trigger metadata instead.
- Each fact must resolve to an origin from `fact.origin ?? batch.default_origin`. Mixed-origin remote import packages must set fact-level origin.
- The service canonicalizes every fact before hashing or writing.

Package metadata:

```ts
type LedgerPackageMetadata = {
  schema_version: string;
  package_id: string;
  produced_at: string;
  content_hash: string;
  source_env_id?: string;
  sync_run_id?: string;
  redaction_level?: string;
};
```

Import metadata:

```ts
type LedgerImportMetadata = {
  schema_version: string;
  export_run_id: string;
  source_env_id: string;
  sync_run_id?: string;
  exported_at: string;
  content_hash: string;
  redaction_level: string;
};
```

Sync metadata:

```ts
type LedgerSyncMetadata = {
  job_run_id: string;
  exchange: "BINANCE";
  account_scope: string;
  endpoint_group: string;
  request_window_start?: string;
  request_window_end?: string;
};
```

Cursor advancement:

```ts
type LedgerCursorAdvancement = {
  owner: string;
  cursor_key: string;
  previous_cursor_value?: string;
  next_cursor_value?: string;
  high_watermark?: string;
  metadata_hash?: string;
};
```

## Fact Commands

All fact commands share a common envelope:

```ts
type LedgerFactCommandBase = {
  kind: LedgerFactKind;
  idempotency_key: string;
  origin?: LedgerFactOrigin;
  occurred_at: string;
  source_event_time?: string;
  payload_hash?: string;
  dimensions?: LedgerFactDimensions;
};

type LedgerFactDimensions = {
  exchange_account_id?: string;
  asset?: string;
  base_asset?: string;
  quote_asset?: string;
  symbol?: string;
  external_id?: string;
  strategy_id?: string;
  strategy_version?: string;
  snapshot_id?: string;
  snapshot_time?: string;
  reported_scope?: string;
};

type LedgerFactKind =
  | "exchange_trade_fill"
  | "exchange_order"
  | "capital_flow_event"
  | "external_trade"
  | "attribution_record"
  | "reversal"
  | "account_balance_snapshot";
```

The initial fact-specific payloads map to the ledger PRD taxonomy:

- `exchange_trade_fill`: one Binance fill; natural key `exchange_account_id + symbol + trade_id`.
- `exchange_order`: one Binance order record; natural key `exchange_account_id + symbol + order_id`.
- `capital_flow_event`: deposit, withdrawal, master/sub transfer, wallet transfer, convert, dust, or dividend; natural key `exchange_account_id + event_type + external_id`.
- `external_trade`: one manual system-external trade; natural key is generated from wallet, side, assets, quantities, `occurred_at`, and optional `tx_id`, then stored as the command idempotency key.
- `attribution_record`: explicit append-only assignment from a source fact to `strategy_id + strategy_version`, or to unallocated/external classification.
- `reversal`: append-only correction pointing to a target fact idempotency key and reason.
- `account_balance_snapshot`: reported balance at a point in time; natural key `exchange_account_id + asset + snapshot_time + reported_scope`.

P2-0 does not need to implement full replay math, but the command shape must preserve enough fields for P2-4 replay and reconciliation.

The target database `source_mode` must not be part of source-fact natural keys. It labels the ingest lane into the current database. If the same real snapshot is first imported through `remote_import` and later observed through `live` in the same database, it must deduplicate or conflict by the real-world natural key plus canonical payload hash rather than becoming two account truths.

`snapshot_id` and `snapshot_time` are different fields. `snapshot_id` points to the decision snapshot container used by review and strategy replay. `snapshot_time` is only the reported balance snapshot timestamp used by `account_balance_snapshot` natural keys. `reported_scope` is the explicit account-balance snapshot scope, such as `spot_total`, `spot_free_locked`, or another implementation-defined enumerable scope. `account_balance_snapshot` natural keys must be built from the typed dimensions, not from ad hoc payload string concatenation.

## Idempotency and Conflict Rules

Each ingest batch has a batch idempotency key. Each fact has a fact idempotency key.

Batch behavior:

- Repeating the same batch key with the same canonical batch hash returns the previous write summary.
- Repeating the same batch key with a different canonical batch hash fails with `IDEMPOTENCY_CONFLICT`.
- Batch metadata is written even when all facts are duplicates, so imports and sync attempts remain auditable.

Fact behavior:

- Repeating the same fact idempotency key with the same canonical payload hash is a no-op for the fact row and increments/records the duplicate observation in the batch summary.
- Repeating the same fact idempotency key with a different canonical payload hash fails the whole batch with `FACT_CONFLICT`.
- `source_mode` alone must not make the same real fact duplicate. A Binance fill imported through `remote_import` and later seen through `live` in the same database is the same fact if its natural key matches.
- `origin` is audit context, not a substitute for a real-world natural key. Origin differences may create different observations of the same fact, but not duplicate source facts.
- Correction never updates the old row. It appends a `reversal` fact and, if needed, appends a replacement fact with a new idempotency key.

## Transaction Boundary

`appendLedgerFacts()` is a single database transaction:

1. Validate source mode, origin, actor, trigger, import/sync metadata, decimal strings, timestamps, and fact shape.
2. Canonicalize the batch and facts.
3. Compute canonical hashes where absent.
4. Insert or find the ingest batch by batch idempotency key.
5. Insert facts using their fact idempotency keys and unique natural keys.
6. Record batch-to-fact observations and duplicate/conflict outcomes.
7. Append import metadata when supplied.
8. Advance `sync_cursor` only after facts are inserted or confirmed duplicate.
9. Return a write summary for replay, reconciliation, and UI refresh.

If any fact conflicts, no new facts and no cursor advancement commit.

## Write Result

The service returns a summary that is safe to show in logs and UI:

```ts
type LedgerIngestResult = {
  batch_id: string;
  batch_idempotency_key: string;
  source_mode: LedgerDataSourceMode;
  inserted: Record<LedgerFactKind, number>;
  skipped_duplicate: Record<LedgerFactKind, number>;
  conflicted: Record<LedgerFactKind, number>;
  cursor_advancements: number;
  replay_hint: {
    earliest_occurred_at?: string;
    affected_exchange_account_ids: string[];
    affected_strategy_ids: string[];
    affected_assets: string[];
  };
};
```

The result must not include API secrets, signed URLs, request headers, signatures, full deposit/withdrawal addresses, or raw signed payloads.

## Reversal Semantics

A reversal is a new fact. It never edits the target fact.

Minimum command fields:

```ts
type LedgerReversalCommand = LedgerFactCommandBase & {
  kind: "reversal";
  target_fact_kind: LedgerFactKind;
  target_fact_idempotency_key: string;
  reason_code: string;
  note?: string;
};
```

Rules:

- The target fact must exist unless an explicit imported-history exception is designed later.
- Reversing an already reversed fact fails unless the command points to the replacement chain intentionally.
- A reversal does not delete raw payload metadata; it marks the accounting effect as reversed during replay.
- Reversal reason codes must be enumerable in implementation, not free-form only.

## Source-Mode Rules by Path

| Path | source_mode in target DB | Required trigger | Required metadata |
| --- | --- | --- | --- |
| Local fixture seed | `fixture` | `fixture_seed` | fixture id |
| Mock ledger service package | `mock` | `mock_generation` | scenario id + package hash |
| Cassette seed | `cassette` | `cassette_seed` | cassette id + content hash |
| Local import of remote package | `remote_import` | `remote_import` | import metadata |
| Remote Binance live sync | `live` | `scheduled_sync` or `manual_sync` | sync metadata |
| Manual external trade in official runtime | `live` | `manual_entry` | user actor + request id |
| Manual attribution in official runtime | `live` | `manual_attribution` | user actor + request id |
| Manual reversal in official runtime | `live` | `manual_reversal` | user actor + request id |

When remote official-runtime facts are exported and imported locally, local rows use `source_mode = "remote_import"` while preserving original origin/trigger metadata for audit.

## Implementation Placement

Expected ownership:

- `src/ledger/ingest/` owns command types, validation, canonicalization, idempotency, and write service.
- Controllers, workers, importers, mock generators, fixtures, and tests may import the command types and call the service.
- They may not import Prisma models or repositories that write source fact tables directly.

The implementation plan should decide whether to expose public types from `src/ledger/index.ts` or a narrower `src/ledger/ingest/index.ts` barrel.

## Initial Verification

- Reject commands without source mode.
- Reject unsupported source mode/trigger/origin combinations.
- Reject commands without idempotency key.
- Reject actor-required commands without actor metadata.
- Reject package/import-derived commands without required package/import metadata.
- Reject live Binance-derived facts without sync metadata.
- Reject financial values supplied as JS numbers.
- Re-importing the same batch is idempotent.
- Re-ingesting the same natural fact through a different source mode does not duplicate the fact.
- `account_balance_snapshot` deduplicates by real-world snapshot identity, not by target database `source_mode`.
- Minimum typed dimensions are populated for replay/page filters when the source fact kind has those values.
- Same idempotency key with changed payload fails as a conflict.
- Cursor advancement does not commit when fact ingest fails.
- Reversal appends a new fact and does not update the target fact.
- Prove fixture seed, mock package, cassette seed, remote import, live sync, external trade, attribution, and reversal paths call the same ingest boundary.
- Prove no controller, importer, worker, mock service, or fixture helper writes source fact tables directly.
