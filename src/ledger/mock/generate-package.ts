import { calculatePackageHash } from "@/ledger/package/hash";
import { validateLedgerPackage } from "@/ledger/package/schema";
import type { LedgerExportPackage, LedgerPackageSummaryRow, LedgerPackageSourceFactRow } from "@/ledger/package/types";
import { mockLedgerPackageProducedAt, mockLedgerScenarios, type MockLedgerScenarioId } from "./scenarios";

export type GenerateMockLedgerPackageInput = {
  scenarioId: MockLedgerScenarioId;
};

export function generateMockLedgerPackage(input: GenerateMockLedgerPackageInput): LedgerExportPackage {
  const scenario = mockLedgerScenarios[input.scenarioId];

  const packageWithoutHash: LedgerExportPackage = {
    manifest: {
      schema_version: "ledger.export.v1",
      package_id: `pkg_p2_1_${input.scenarioId}`,
      package_kind: "mock",
      export_run_id: `lexp_mock_${input.scenarioId}`,
      source_env_id: "mock-local",
      sync_run_id: `job_mock_${input.scenarioId}`,
      scenario_id: input.scenarioId,
      produced_at: mockLedgerPackageProducedAt,
      content_hash: "",
      redaction_level: "none"
    },
    exchange_accounts: cloneRows(scenario.exchange_accounts),
    api_key_health_summaries: cloneRows(scenario.api_key_health_summaries),
    exchange_trade_fills: cloneRows(scenario.exchange_trade_fills),
    exchange_orders: cloneRows(scenario.exchange_orders),
    capital_flow_events: cloneRows(scenario.capital_flow_events),
    external_trades: cloneRows(scenario.external_trades),
    attribution_records: cloneRows(scenario.attribution_records),
    reversals: cloneRows(scenario.reversals),
    account_balance_snapshots: cloneRows(scenario.account_balance_snapshots),
    reconciliation_results: cloneRows(scenario.reconciliation_results),
    sync_cursor_summaries: cloneRows(scenario.sync_cursor_summaries),
    raw_payload_redacted: cloneRows(scenario.raw_payload_redacted)
  };

  const packageWithHash: LedgerExportPackage = {
    ...packageWithoutHash,
    manifest: {
      ...packageWithoutHash.manifest,
      content_hash: calculatePackageHash(packageWithoutHash)
    }
  };

  return validateLedgerPackage(packageWithHash);
}

function cloneRows<T extends LedgerPackageSourceFactRow | LedgerPackageSummaryRow>(rows: T[] | undefined): T[] {
  if (!rows) {
    return [];
  }

  return JSON.parse(JSON.stringify(rows)) as T[];
}
