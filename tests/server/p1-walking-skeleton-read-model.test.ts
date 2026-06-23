import { describe, expect, it } from "vitest";
import {
  getP1LedgerReadModel,
  getP1MarketReadModel
} from "@/server/read-model/p1-walking-skeleton";

describe("P1 walking skeleton read model", () => {
  it("exposes a market summary without raw snapshot content", () => {
    const market = getP1MarketReadModel();

    expect(market.snapshotRef).toMatchObject({
      snapshot_id: "snap_2026_06_19_0001",
      schema_version: "phase1.snapshot.v1"
    });
    expect(market.snapshotSummary).toEqual({
      snapshot_id: "snap_2026_06_19_0001",
      signal_count: 3,
      input_count: 6,
      enabled_signal_ids: ["risk_regime", "core_tilt", "funding_sentiment"],
      data_health: "complete"
    });
    expect(market.activeSignalSet.signals.map((signal) => signal.lifecycle_state)).toEqual([
      "enabled",
      "enabled",
      "enabled"
    ]);
    expect(JSON.stringify(market)).not.toContain("raw_payload");
    expect(JSON.stringify(market)).not.toContain("rawPayload");
  });

  it("exposes a ledger summary with traceability and fixture statuses", () => {
    const ledger = getP1LedgerReadModel();

    expect(ledger.positionView.strategy_version).toBe("v1");
    expect(ledger.tradeViews[0]).toMatchObject({
      trade_id: "trade_2026_06_19_0001",
      snapshot_id: ledger.plannedAction.snapshot_id,
      strategy_version: ledger.plannedAction.strategy_version
    });
    expect(ledger.traceability).toEqual({
      snapshot_id: "snap_2026_06_19_0001",
      strategy_version: "v1",
      ledger_event_ids: ["evt_flow_001", "evt_trade_001"],
      trade_ids: ["trade_2026_06_19_0001"]
    });
    expect(ledger.syncStatus).toEqual({
      state: "fixture_synced",
      source: "fixture",
      last_synced_at: "2026-06-19T00:05:00.000Z"
    });
    expect(ledger.reconciliationStatus).toEqual({
      state: "fixture_reconciled",
      source: "fixture",
      checked_at: "2026-06-19T00:05:00.000Z"
    });
    expect(JSON.stringify(ledger)).not.toContain("raw_payload");
    expect(JSON.stringify(ledger)).not.toContain("key_ref");
  });
});
