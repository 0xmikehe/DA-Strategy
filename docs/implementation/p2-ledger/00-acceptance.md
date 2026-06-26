# P2 Ledger Acceptance

P2 ledger is accepted only when the system can ingest, replay, reconcile, display, and safely audit account facts without breaking the project boundaries.

## Default Local Gate

The default gate remains offline:

```text
npm run verify
```

It must not require live Binance access, remote machine access, or real account secrets.

## Overall Acceptance

- All account source fact mutations go through `appendLedgerFacts()`.
- Derived audit/result rows, such as `reconciliation_result`, are append-only but are not source facts. They may be appended by their owning service only when that service is forbidden from writing source fact tables or sync cursors.
- Control-plane state, such as export run metadata, backup run metadata, credential health, and alerts, remains outside the source fact writer boundary. These records must not be treated as account truth.
- Live sync, local import, cassette seed, external trade entry, attribution, and reversal paths are tested against the same ingest boundary.
- Mock ledger service output is deterministic, offline, and routed through the same import/ingest path.
- Ledger source facts are append-only; correction uses reversal or follow-up facts rather than silent update/delete.
- Every fact has source mode: `fixture`, `mock`, `cassette`, `remote_import`, or `live`.
- Every fact has origin and trigger metadata, either from its own command or from the ingest batch default.
- Manual official-runtime facts use `source_mode = "live"` with manual origin/trigger metadata; local copies imported from remote use `source_mode = "remote_import"` while preserving the original origin/trigger.
- Mock data is visibly marked as `mock`, never as `remote_import` or `live`.
- Repeated import or sync of the same facts is idempotent.
- Local imported data is visibly marked as `remote_import`, never as `live`.
- Sync cursor advancement is committed through `appendLedgerFacts()` with the successful fact batch, never as a separate direct write after fact inserts.
- Export packages include `schema_version`, `export_run_id`, `source_env_id`, `sync_run_id`, `exported_at`, `content_hash`, and redaction metadata.
- Exported packages do not contain API secrets, signed URLs, request headers, signatures, or full secret-bearing payloads.
- Live Binance calls are opt-in commands and run only where read-only account keys are configured.
- P2-3a owns the offline/default-gate account binding and credential-health baseline: `exchange_account`, `api_credential`, `api_key_health_check`, and `account_binding_audit`.
- P2-3b owns signed live sync and remains explicit opt-in. Offline pages and imports can use mocked/imported binding summaries without live Binance access.
- Exchange-internal fills are automatically attributed from the physical subaccount binding active at the fill time. Manual attribution is a fallback for external, exceptional, or unresolved events.
- Trade facts can carry `snapshot_id` when a decision snapshot is available. Missing `snapshot_id` is explicit and visible; it is not replaced by `snapshot_time`.
- Reconciliation can compare replayed balances with reported balance snapshots and produce durable result records.
- Ledger page states make freshness, data source, reconciliation result, and pending attribution visible.
- Remote ops commands validate configuration without printing secret values.
- Remote backup includes source facts, snapshots, manual/operator facts, sync cursors, metadata, and checksums; it excludes plaintext secrets. It may include rebuildable derived results for audit convenience, but restore correctness must not depend on derived result rows.
- Restore smoke uses a scratch database and refuses production DB targets.
- Logs, alerts, exports, backup metadata, and operator summaries are redacted before publication.
- Alert payloads use safe reason codes and do not include account-sensitive balances or secret-bearing material.

## Explicit Live Gates

These commands may require remote secrets and network access, so they are not part of the default local gate:

```text
npm run ledger:live-smoke
npm run ledger:backup
npm run ledger:export
npm run ledger:restore-smoke
```

The exact commands may be adjusted during implementation, but they must remain explicit opt-in gates.
