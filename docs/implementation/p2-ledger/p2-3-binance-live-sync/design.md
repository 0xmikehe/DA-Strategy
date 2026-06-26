# P2-3 Binance Live Sync Design

## Goal

Run real Binance account sync on the remote runtime, maintain the account binding/key-health baseline required for that sync, automatically attribute exchange-internal facts from physical subaccount bindings, and submit normalized ledger facts through `appendLedgerFacts()`.

Live sync is never the default local mode and is never part of `npm run verify`.

## Prerequisites

P2-3 depends on:

- P2-0 ingest kernel and fact/cursor transaction boundary.
- P2-1 mock/import/cassette paths for offline development and regression.
- P2-2 exporter for moving remote results back into local development.
- Ledger PRD account binding/key health model.
- Read-only Binance credentials configured only on the remote runtime.

## Components

### Account Binding and Credential Baseline

P2-3 owns the baseline schema and services for:

- `exchange_account`
- `api_credential`
- `api_key_health_check`
- `account_binding_audit`

If earlier phases have not created these models, P2-3 creates them before live sync workers. Secret material never enters these tables: `api_credential` stores a `key_ref` and safe metadata only.

Responsibilities:

- discover master and subaccounts when the configured key can access discovery endpoints.
- maintain account role, subaccount identifiers, active/frozen status, and safe local labels.
- append binding audit records for strategy/account/key bind, unbind, key rotation, and blocked-key state changes.
- expose active binding windows for sync routing and automatic attribution.
- write key health checks as append-only operational/security audit records.

Binding and credential lifecycle state is control-plane/account-configuration state, not an account source fact. It does not go through `appendLedgerFacts()`. When a sync worker produces account source facts, those facts still go through `appendLedgerFacts()`.

### Binding and Route Resolver

The collector resolves active ledger account bindings:

- master account route for account discovery, master/sub transfers, deposits, withdrawals, and subaccount summaries.
- strategy subaccount route for account balances, trades, orders, convert, dust, dividends, and wallet transfers where the endpoint requires the subaccount key.
- `key_ref` is resolved at runtime from remote environment secrets.
- active binding windows provide `strategy_id` and the effective `strategy_version` for exchange-internal facts.

The resolver returns endpoint work items. It does not expose secrets to strategy, signal, frontend, or package export.

### Key Health Gate

Before sync, the collector runs or checks recent key health:

- `enableReading = true` required.
- `enableWithdrawals = false` required.
- `enableSpotAndMarginTrading = false` required.
- Missing IP restriction is `WARN`, not automatic block.
- Any unsafe permission is `BLOCK` and prevents sync for that credential.

Health summaries may be exported later through P2-2, but secrets never are.

### Automatic Physical-Subaccount Attribution

For exchange-internal facts, automatic attribution is the default path:

```text
exchange_account_id + event time
  -> active account binding window
  -> strategy_id + strategy_version
  -> optional decision snapshot lookup
  -> typed dimensions on the LedgerFactCommand
```

Rules:

- Normal exchange fills from a bound strategy subaccount receive `strategy_id` and `strategy_version` before calling `appendLedgerFacts()`.
- The version is resolved by event time, not by current strategy version.
- When a decision snapshot exists at or before the event time, the fact carries `snapshot_id`.
- If no snapshot exists, `snapshot_id` is `null`/absent with an explicit diagnostic; it must not be replaced by `snapshot_time`.
- Master-account funding and operational transfers may remain unassigned or become capital-flow facts according to the PRD route table.
- Facts that cannot satisfy the automatic attribution rule are marked for P2-5 pending attribution rather than silently assigned.

### Binance Client

The Binance client owns signed USER_DATA request construction.

Responsibilities:

- Resolve key material from `key_ref`.
- Sign requests inside the remote runtime only.
- Apply server-time correction for timestamp drift.
- Return normalized response envelopes with request metadata safe for logs.

Non-responsibilities:

- It does not write ledger facts.
- It does not expose `/api/binance/*`.
- It does not return full signed URLs or headers to local packages.

### Rate Limit and Retry Policy

The collector applies endpoint weight budgeting:

- Track IP weight and UID weight separately where Binance exposes them.
- Use low concurrency by default.
- Retry transient errors with bounded exponential backoff.
- Respect `Retry-After` when present.
- Treat auth/permission errors as blocking health failures.
- Persist job failure state without advancing fact cursors.

### Endpoint Workers

Initial endpoint groups:

| Endpoint group | Facts produced |
| --- | --- |
| `spot_my_trades` | `exchange_trade_fill` |
| `spot_all_orders` | `exchange_order` |
| `account_balance` | `account_balance_snapshot` |
| `master_sub_transfer` | `capital_flow_event` |
| `deposit_history` | `capital_flow_event` |
| `withdraw_history` | `capital_flow_event` |
| `wallet_transfer` | `capital_flow_event` |
| `convert_trade_flow` | `capital_flow_event` |
| `dust_history` | `capital_flow_event` |
| `asset_dividend` | `capital_flow_event` |

Each endpoint worker:

- Reads its cursor/window.
- Calls Binance.
- Filters to terminal/successful records when required.
- Normalizes records into `LedgerIngestCommand`.
- Enriches fact dimensions with account, asset/symbol, automatic attribution, and `snapshot_id` where available.
- Sets `source_mode = "live"`.
- Sets origin to `{ kind: "binance_user_data", endpoint }`.
- Adds sync metadata.
- Submits facts and cursor advancement through `appendLedgerFacts()` in one transaction.

### Sync Cursor Strategy

Cursor keys are per endpoint, account, and symbol or asset where needed.

Examples:

- `ledger:acct_1:spot_my_trades:BTCUSDT`
- `ledger:acct_1:spot_all_orders:ETHUSDT`
- `ledger:master:deposit_history`
- `ledger:acct_1:convert_trade_flow`

Rules:

- Cursor advances only through `appendLedgerFacts()`.
- Empty successful windows may advance cursor through an empty live ingest batch.
- Failed or partially normalized windows do not advance cursor.
- Replayed windows are safe because fact idempotency prevents duplicates.

## Data Flow

```text
scheduled/manual live sync job
  -> resolve bindings and endpoint work items
  -> verify key health
  -> run weighted Binance requests
  -> normalize response records
  -> appendLedgerFacts(source_mode = "live", facts, cursor_advancements)
  -> trigger replay/reconciliation after successful batch
  -> P2-2 can export resulting facts for local import
```

## Source Mode and Metadata

Every Binance-derived live fact uses:

- `source_mode = "live"`
- `origin.kind = "binance_user_data"`
- `trigger.kind = "scheduled_sync"` or `manual_sync`
- `actor.kind = "system"` with `name = "ledger-worker"`
- `sync_metadata.exchange = "BINANCE"`

Manual official-runtime facts are not produced by P2-3. They belong to P2-5, even though they also use `source_mode = "live"` in the official runtime.

## Failure Semantics

- Unsafe key health blocks endpoint work before any Binance request.
- Auth/permission failure marks the affected credential/account blocked or failed and does not advance fact cursors.
- Rate-limit failure retries within policy; exhausted retries record job failure and do not advance cursor.
- Endpoint parse failure aborts that endpoint batch and does not advance cursor.
- Partial endpoint failure does not block unrelated endpoint groups for other accounts.
- Duplicate pages and repeated windows are safe through P2-0 idempotency.
- Raw signed request material is never logged or exported.

## Explicit Live Commands

Initial commands:

```text
npm run ledger:live-smoke
npm run ledger:sync -- --account acct_1 --endpoint spot_my_trades --symbol BTCUSDT
npm run ledger:sync -- --all-active
```

These commands are explicit opt-in. CI and default local verification must not run them.

## Boundaries

- The collector does not write ledger source facts directly.
- The collector does not advance fact-related `sync_cursor` rows outside the ingest transaction.
- Generic job lifecycle state may stay in worker orchestration, but committed facts and committed cursors are one ingest boundary.
- Strategy and signal layers do not call signed account APIs.
- Account-sync credentials belong to the ledger layer.
- Local development receives live-derived data through P2-2 export and P2-1 import, not through a transparent API proxy.

## Verification

- Live smoke is explicit opt-in.
- Key health blocks unsafe or invalid credentials before account sync.
- Duplicate pages or repeated sync windows do not duplicate facts.
- Cursor advancement does not commit when fact ingest fails.
- Empty successful windows can advance cursor through `appendLedgerFacts()`.
- Partial endpoint failures produce durable job/run health state.
- All successful normalized facts enter through `appendLedgerFacts()`.
- No default local or CI gate makes live Binance requests.
