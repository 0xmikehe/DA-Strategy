import { readFile } from "node:fs/promises";
import { appendLedgerFacts, type LedgerDataSourceMode, type LedgerIngestResult } from "@/ledger/ingest";
import { verifyPackageHash } from "./hash";
import { mapLedgerPackageToIngestCommand, packageKindToSourceMode, type MapLedgerPackageToIngestOptions } from "./map-to-ingest";
import type { LedgerExportPackage, LedgerPackageSummaryRow } from "./types";

export type ImportLedgerPackageOptions = MapLedgerPackageToIngestOptions;

export type IgnoredPackageSection = {
  section: string;
  count: number;
  reason: string;
  ignored_until_phase?: string;
};

export type ImportLedgerPackageSummary = {
  package_id: string;
  source_mode: LedgerDataSourceMode;
  result: LedgerIngestResult;
  ignored_sections: IgnoredPackageSection[];
};

const factKinds = [
  "exchange_trade_fill",
  "exchange_order",
  "capital_flow_event",
  "external_trade",
  "attribution_record",
  "reversal",
  "account_balance_snapshot"
] as const;

export async function importLedgerPackage(
  packageOrPath: LedgerExportPackage | string,
  options: ImportLedgerPackageOptions = {}
): Promise<ImportLedgerPackageSummary> {
  const rawPackage = typeof packageOrPath === "string" ? await readPackageFile(packageOrPath) : packageOrPath;
  const ledgerPackage = verifyPackageHash(rawPackage);
  const sourceMode = packageKindToSourceMode(ledgerPackage.manifest.package_kind);
  const command = mapLedgerPackageToIngestCommand(ledgerPackage, options);
  const result =
    command.facts.length > 0 || (command.cursor_advancements?.length ?? 0) > 0
      ? await appendLedgerFacts(command)
      : emptyIngestResult(sourceMode, command.batch.idempotency_key);

  return {
    package_id: ledgerPackage.manifest.package_id,
    source_mode: sourceMode,
    result,
    ignored_sections: ignoredSections(ledgerPackage, options)
  };
}

async function readPackageFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function ignoredSections(ledgerPackage: LedgerExportPackage, options: ImportLedgerPackageOptions): IgnoredPackageSection[] {
  return [
    ignoredWhenPresent("exchange_accounts", ledgerPackage.exchange_accounts, "read_only_summary"),
    ignoredWhenPresent("api_key_health_summaries", ledgerPackage.api_key_health_summaries, "read_only_summary"),
    ignoredWhenPresent("reconciliation_results", ledgerPackage.reconciliation_results, "derived_result_import_not_available", "P2-4"),
    options.trustedRestore
      ? undefined
      : ignoredWhenPresent("sync_cursor_summaries", ledgerPackage.sync_cursor_summaries, "cursor_restore_requires_trusted_mode"),
    ignoredWhenPresent("raw_payload_redacted", ledgerPackage.raw_payload_redacted, "redacted_evidence_only")
  ].filter((section): section is IgnoredPackageSection => Boolean(section));
}

function ignoredWhenPresent(
  section: string,
  rows: LedgerPackageSummaryRow[],
  reason: string,
  ignoredUntilPhase?: string
): IgnoredPackageSection | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  return {
    section,
    count: rows.length,
    reason,
    ignored_until_phase: ignoredUntilPhase
  };
}

function emptyIngestResult(sourceMode: LedgerDataSourceMode, batchIdempotencyKey: string): LedgerIngestResult {
  const zeroCounts = Object.fromEntries(factKinds.map((kind) => [kind, 0])) as LedgerIngestResult["inserted"];

  return {
    batch_id: "",
    batch_idempotency_key: batchIdempotencyKey,
    source_mode: sourceMode,
    inserted: zeroCounts,
    skipped_duplicate: zeroCounts,
    conflicted: zeroCounts,
    cursor_advancements: 0,
    replay_hint: {
      affected_exchange_account_ids: [],
      affected_strategy_ids: [],
      affected_assets: []
    }
  };
}
