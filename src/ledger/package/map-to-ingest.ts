import type {
  LedgerCursorAdvancement,
  LedgerDataSourceMode,
  LedgerFactCommand,
  LedgerFactKind,
  LedgerFactOrigin,
  LedgerIngestActor,
  LedgerIngestCommand,
  LedgerIngestTrigger
} from "@/ledger/ingest";
import { LedgerPackageValidationError } from "./schema";
import type { LedgerExportPackage, LedgerPackageSourceFactRow, LedgerPackageSourceFactSection } from "./types";

export type MapLedgerPackageToIngestOptions = {
  importRunId?: string;
  requestedAt?: string;
  trustedRestore?: boolean;
};

const sectionKindMap: Record<LedgerPackageSourceFactSection, LedgerFactKind> = {
  exchange_trade_fills: "exchange_trade_fill",
  exchange_orders: "exchange_order",
  capital_flow_events: "capital_flow_event",
  external_trades: "external_trade",
  attribution_records: "attribution_record",
  reversals: "reversal",
  account_balance_snapshots: "account_balance_snapshot"
};

export function mapLedgerPackageToIngestCommand(
  ledgerPackage: LedgerExportPackage,
  options: MapLedgerPackageToIngestOptions = {}
): LedgerIngestCommand {
  const sourceMode = packageKindToSourceMode(ledgerPackage.manifest.package_kind);
  const facts = Object.entries(sectionKindMap).flatMap(([section, kind]) =>
    ledgerPackage[section as LedgerPackageSourceFactSection].map((row) => mapSourceFactRow(kind, row))
  );
  const cursorAdvancements = options.trustedRestore ? mapCursorSummaries(ledgerPackage.sync_cursor_summaries) : [];

  return {
    batch: {
      idempotency_key: `ledger-package-import:${sourceMode}:${ledgerPackage.manifest.package_id}:${ledgerPackage.manifest.content_hash}`,
      source_mode: sourceMode,
      default_origin: defaultOriginForPackage(ledgerPackage),
      actor: actorForSourceMode(sourceMode),
      trigger: triggerForPackage(ledgerPackage, options),
      requested_at: options.requestedAt ?? ledgerPackage.manifest.produced_at,
      package_metadata: {
        schema_version: ledgerPackage.manifest.schema_version,
        package_id: ledgerPackage.manifest.package_id,
        produced_at: ledgerPackage.manifest.produced_at,
        content_hash: ledgerPackage.manifest.content_hash,
        source_env_id: ledgerPackage.manifest.source_env_id,
        sync_run_id: ledgerPackage.manifest.sync_run_id,
        redaction_level: ledgerPackage.manifest.redaction_level
      },
      import_metadata:
        sourceMode === "remote_import"
          ? {
              schema_version: ledgerPackage.manifest.schema_version,
              export_run_id: ledgerPackage.manifest.export_run_id,
              source_env_id: ledgerPackage.manifest.source_env_id,
              sync_run_id: ledgerPackage.manifest.sync_run_id,
              exported_at: ledgerPackage.manifest.produced_at,
              content_hash: ledgerPackage.manifest.content_hash,
              redaction_level: ledgerPackage.manifest.redaction_level
            }
          : undefined
    },
    facts,
    cursor_advancements: cursorAdvancements.length > 0 ? cursorAdvancements : undefined
  };
}

export function packageKindToSourceMode(packageKind: LedgerExportPackage["manifest"]["package_kind"]): LedgerDataSourceMode {
  switch (packageKind) {
    case "mock":
      return "mock";
    case "remote_export":
      return "remote_import";
    case "cassette":
      return "cassette";
  }
}

function mapSourceFactRow(kind: LedgerFactKind, row: LedgerPackageSourceFactRow): LedgerFactCommand {
  return {
    kind,
    idempotency_key: row.idempotency_key,
    natural_key: row.natural_key,
    origin: row.origin,
    occurred_at: row.occurred_at,
    source_event_time: row.source_event_time,
    payload_hash: row.payload_hash,
    dimensions: row.dimensions,
    payload: row.payload
  };
}

function defaultOriginForPackage(ledgerPackage: LedgerExportPackage): LedgerFactOrigin {
  switch (ledgerPackage.manifest.package_kind) {
    case "mock":
      if (!ledgerPackage.manifest.scenario_id) {
        throw new LedgerPackageValidationError("LEDGER_PACKAGE_SCENARIO_REQUIRED", "mock packages require scenario_id");
      }
      return { kind: "mock_scenario", scenario_id: ledgerPackage.manifest.scenario_id };
    case "remote_export":
      return {
        kind: "remote_export",
        export_run_id: ledgerPackage.manifest.export_run_id,
        original_source_mode: "live"
      };
    case "cassette":
      if (!ledgerPackage.manifest.cassette_id) {
        throw new LedgerPackageValidationError("LEDGER_PACKAGE_CASSETTE_REQUIRED", "cassette packages require cassette_id");
      }
      return { kind: "cassette", cassette_id: ledgerPackage.manifest.cassette_id };
  }
}

function actorForSourceMode(sourceMode: LedgerDataSourceMode): LedgerIngestActor {
  switch (sourceMode) {
    case "mock":
      return { kind: "system", name: "mock-ledger-service" };
    case "cassette":
      return { kind: "system", name: "cassette-seed" };
    case "remote_import":
      return { kind: "import_tool", name: "ledger-import-package" };
    default:
      return { kind: "import_tool", name: "ledger-import-package" };
  }
}

function triggerForPackage(
  ledgerPackage: LedgerExportPackage,
  options: MapLedgerPackageToIngestOptions
): LedgerIngestTrigger {
  switch (ledgerPackage.manifest.package_kind) {
    case "mock":
      return { kind: "mock_generation", scenario_id: ledgerPackage.manifest.scenario_id ?? ledgerPackage.manifest.package_id };
    case "cassette":
      return { kind: "cassette_seed", cassette_id: ledgerPackage.manifest.cassette_id ?? ledgerPackage.manifest.package_id };
    case "remote_export":
      return { kind: "remote_import", import_run_id: options.importRunId ?? `import:${ledgerPackage.manifest.package_id}` };
  }
}

function mapCursorSummaries(rows: LedgerExportPackage["sync_cursor_summaries"]): LedgerCursorAdvancement[] {
  return rows.flatMap((row) => {
    if (typeof row.owner !== "string" || typeof row.cursor_key !== "string") {
      return [];
    }

    return [
      {
        owner: row.owner,
        cursor_key: row.cursor_key,
        previous_cursor_value: stringValue(row.previous_cursor_value),
        next_cursor_value: stringValue(row.next_cursor_value),
        high_watermark: stringValue(row.high_watermark),
        metadata_hash: stringValue(row.metadata_hash)
      }
    ];
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
