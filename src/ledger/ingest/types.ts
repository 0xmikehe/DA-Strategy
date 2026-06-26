export type DecimalString = string;
export type IsoDateTimeString = string;

export type LedgerDataSourceMode = "fixture" | "mock" | "cassette" | "remote_import" | "live";

export type LedgerFactKind =
  | "exchange_trade_fill"
  | "exchange_order"
  | "capital_flow_event"
  | "external_trade"
  | "attribution_record"
  | "reversal"
  | "account_balance_snapshot";

export type LedgerFactOrigin =
  | { kind: "binance_user_data"; endpoint: string; original_source_mode?: LedgerDataSourceMode }
  | { kind: "remote_export"; export_run_id: string; original_source_mode?: LedgerDataSourceMode }
  | { kind: "mock_scenario"; scenario_id: string }
  | { kind: "cassette"; cassette_id: string }
  | { kind: "fixture"; fixture_id: string }
  | { kind: "manual_external_trade" }
  | { kind: "manual_attribution" }
  | { kind: "manual_reversal" };

export type LedgerIngestActor =
  | { kind: "system"; name: "ledger-worker" | "mock-ledger-service" | "fixture-seed" | "cassette-seed" }
  | { kind: "user"; user_id: string }
  | { kind: "agent"; agent_id: string }
  | { kind: "import_tool"; name: string };

export type LedgerIngestTrigger =
  | { kind: "scheduled_sync"; job_run_id: string }
  | { kind: "manual_sync"; job_run_id: string; requested_by: string }
  | { kind: "remote_import"; import_run_id: string }
  | { kind: "mock_generation"; scenario_id: string }
  | { kind: "cassette_seed"; cassette_id: string }
  | { kind: "fixture_seed"; fixture_id: string }
  | { kind: "manual_entry"; request_id: string }
  | { kind: "manual_attribution"; request_id: string }
  | { kind: "manual_reversal"; request_id: string };

export type LedgerPackageMetadata = {
  schema_version: string;
  package_id: string;
  produced_at: IsoDateTimeString;
  content_hash: string;
  source_env_id?: string;
  sync_run_id?: string;
  redaction_level?: string;
};

export type LedgerImportMetadata = {
  schema_version: string;
  export_run_id: string;
  source_env_id: string;
  sync_run_id?: string;
  exported_at: IsoDateTimeString;
  content_hash: string;
  redaction_level: string;
};

export type LedgerSyncMetadata = {
  job_run_id: string;
  exchange: "BINANCE";
  account_scope: string;
  endpoint_group: string;
  request_window_start?: IsoDateTimeString;
  request_window_end?: IsoDateTimeString;
};

export type LedgerCursorAdvancement = {
  owner: string;
  cursor_key: string;
  previous_cursor_value?: string;
  next_cursor_value?: string;
  high_watermark?: IsoDateTimeString;
  metadata_hash?: string;
};

export type LedgerFactDimensions = {
  exchange_account_id?: string;
  asset?: string;
  base_asset?: string;
  quote_asset?: string;
  symbol?: string;
  external_id?: string;
  strategy_id?: string;
  strategy_version?: string;
  snapshot_id?: string;
  snapshot_time?: IsoDateTimeString;
  reported_scope?: string;
};

export type LedgerIngestBatch = {
  idempotency_key: string;
  source_mode: LedgerDataSourceMode;
  default_origin?: LedgerFactOrigin;
  actor: LedgerIngestActor;
  trigger: LedgerIngestTrigger;
  requested_at: IsoDateTimeString;
  package_metadata?: LedgerPackageMetadata;
  import_metadata?: LedgerImportMetadata;
  sync_metadata?: LedgerSyncMetadata;
};

export type LedgerFactCommand = {
  kind: LedgerFactKind;
  idempotency_key: string;
  natural_key: string;
  origin?: LedgerFactOrigin;
  occurred_at: IsoDateTimeString;
  source_event_time?: IsoDateTimeString;
  payload_hash?: string;
  dimensions?: LedgerFactDimensions;
  payload: Record<string, unknown>;
};

export type LedgerIngestCommand = {
  batch: LedgerIngestBatch;
  facts: LedgerFactCommand[];
  cursor_advancements?: LedgerCursorAdvancement[];
};

export type LedgerIngestResult = {
  batch_id: string;
  batch_idempotency_key: string;
  source_mode: LedgerDataSourceMode;
  inserted: Record<LedgerFactKind, number>;
  skipped_duplicate: Record<LedgerFactKind, number>;
  conflicted: Record<LedgerFactKind, number>;
  cursor_advancements: number;
  replay_hint: {
    earliest_occurred_at?: IsoDateTimeString;
    affected_exchange_account_ids: string[];
    affected_strategy_ids: string[];
    affected_assets: string[];
  };
};
