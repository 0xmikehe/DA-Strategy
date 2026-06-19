import type { ActiveSignalSet, LedgerPositionView, PlannedAction } from "@/contracts/phase1";
import { plannedActionSchema } from "@/contracts/phase1.schemas";

export type BuildPlannedActionInput = {
  active_signal_set: ActiveSignalSet;
  ledger_position: LedgerPositionView;
};

export function buildPlannedAction(input: BuildPlannedActionInput): PlannedAction {
  const riskRegime = input.active_signal_set.signals.find((signal) => signal.signal_id === "risk_regime");
  const btcPosition = input.ledger_position.assets.find((asset) => asset.asset === "BTC");
  const hasBtcPosition = btcPosition ? !isZeroDecimalString(btcPosition.total_qty) : false;
  const actionType = input.active_signal_set.data_health === "complete" && riskRegime?.value === "risk_on" && hasBtcPosition
    ? "hold"
    : "manual_check";
  const targetAllocationBandRef = riskRegime?.value === "risk_on" ? "core_v1_risk_on" : "core_v1_neutral";
  const reasonCodes = [
    ...input.active_signal_set.signals.flatMap((signal) => signal.reason_codes),
    actionType === "hold" ? "position_within_fixture_band" : "manual_review_required"
  ];

  return plannedActionSchema.parse({
    action_id: `act_${input.active_signal_set.snapshot_id.replace(/^snap_/, "snap_")}`,
    strategy_id: input.ledger_position.strategy_id,
    strategy_version: input.ledger_position.strategy_version,
    snapshot_id: input.active_signal_set.snapshot_id,
    action_type: actionType,
    target_allocation_band_ref: targetAllocationBandRef,
    reason_codes: reasonCodes,
    created_at: input.active_signal_set.as_of,
    status: "draft"
  });
}

function isZeroDecimalString(value: string): boolean {
  return /^-?0+(\.0+)?$/.test(value);
}
