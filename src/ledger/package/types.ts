import type { LedgerFactDimensions, LedgerFactOrigin, LedgerIngestTrigger } from "@/ledger/ingest";

export type LedgerPackageKind = "mock" | "remote_export" | "cassette";

export type LedgerPackageManifest = {
  schema_version: "ledger.export.v1";
  package_id: string;
  package_kind: LedgerPackageKind;
  export_run_id: string;
  source_env_id: string;
  sync_run_id?: string;
  scenario_id?: string;
  cassette_id?: string;
  produced_at: string;
  content_hash: string;
  redaction_level: string;
};

export type LedgerPackageSourceFactRow = {
  idempotency_key: string;
  natural_key: string;
  origin?: LedgerFactOrigin;
  trigger?: LedgerIngestTrigger;
  occurred_at: string;
  source_event_time?: string;
  payload_hash?: string;
  dimensions?: LedgerFactDimensions;
  payload: Record<string, unknown>;
};

export type LedgerPackageSummaryRow = Record<string, unknown>;

export type LedgerExportPackage = {
  manifest: LedgerPackageManifest;
  exchange_accounts: LedgerPackageSummaryRow[];
  api_key_health_summaries: LedgerPackageSummaryRow[];
  exchange_trade_fills: LedgerPackageSourceFactRow[];
  exchange_orders: LedgerPackageSourceFactRow[];
  capital_flow_events: LedgerPackageSourceFactRow[];
  external_trades: LedgerPackageSourceFactRow[];
  attribution_records: LedgerPackageSourceFactRow[];
  reversals: LedgerPackageSourceFactRow[];
  account_balance_snapshots: LedgerPackageSourceFactRow[];
  reconciliation_results: LedgerPackageSummaryRow[];
  sync_cursor_summaries: LedgerPackageSummaryRow[];
  raw_payload_redacted: LedgerPackageSummaryRow[];
};

export const ledgerPackageSourceFactSections = [
  "exchange_trade_fills",
  "exchange_orders",
  "capital_flow_events",
  "external_trades",
  "attribution_records",
  "reversals",
  "account_balance_snapshots"
] as const;

export type LedgerPackageSourceFactSection = (typeof ledgerPackageSourceFactSections)[number];
