import { describe, expect, it } from "vitest";
import type {
  ActiveSignalSet,
  LedgerPositionView,
  PlannedAction
} from "@/contracts/phase1";

describe("Phase 1 contracts", () => {
  it("links enabled signals, ledger position, and planned action by snapshot and strategy version", () => {
    const activeSignals: ActiveSignalSet = {
      snapshot_id: "snap_2026_06_19_0001",
      as_of: "2026-06-19T00:00:00.000Z",
      data_health: "complete",
      signals: [
        {
          signal_id: "btc_trend",
          signal_version: "v1",
          lifecycle_state: "enabled",
          value: "up",
          raw_value: "1.0",
          evaluated_at: "2026-06-19T00:00:00.000Z",
          reason_codes: ["fixture"]
        }
      ]
    };

    const ledgerPosition: LedgerPositionView = {
      strategy_id: "core_allocation_lt",
      strategy_version: "v1",
      as_of: "2026-06-19T00:00:00.000Z",
      assets: [
        {
          asset: "BTC",
          free_qty: "0.10000000",
          locked_qty: "0",
          total_qty: "0.10000000",
          cost_basis_quote: "6500.00"
        }
      ]
    };

    const plannedAction: PlannedAction = {
      action_id: "act_2026_06_19_0001",
      strategy_id: ledgerPosition.strategy_id,
      strategy_version: ledgerPosition.strategy_version,
      snapshot_id: activeSignals.snapshot_id,
      action_type: "hold",
      target_allocation_band_ref: "core_v1_neutral",
      reason_codes: ["btc_trend_up"],
      created_at: "2026-06-19T00:00:00.000Z",
      status: "draft"
    };

    expect(plannedAction.snapshot_id).toBe(activeSignals.snapshot_id);
    expect(plannedAction.strategy_version).toBe(ledgerPosition.strategy_version);
  });
});
