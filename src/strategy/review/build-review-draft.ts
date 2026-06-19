import type {
  LedgerPositionView,
  LedgerTradeView,
  PlannedAction,
  ReviewDraft,
  SignalSnapshotRef
} from "@/contracts/phase1";
import { reviewDraftSchema } from "@/contracts/phase1.schemas";

export type BuildReviewDraftInput = {
  period_start: string;
  period_end: string;
  snapshot_refs: SignalSnapshotRef[];
  planned_action: PlannedAction;
  ledger_position: LedgerPositionView;
  trade_views: LedgerTradeView[];
};

export function buildReviewDraft(input: BuildReviewDraftInput): ReviewDraft {
  const primarySnapshot = input.snapshot_refs[0];

  if (!primarySnapshot) {
    throw new Error("P1 review draft requires at least one snapshot ref");
  }

  return reviewDraftSchema.parse({
    review_id: buildReviewId(
      input.planned_action.strategy_id,
      input.planned_action.strategy_version,
      input.period_start
    ),
    strategy_id: input.planned_action.strategy_id,
    strategy_version: input.planned_action.strategy_version,
    period_start: input.period_start,
    period_end: input.period_end,
    snapshot_refs: input.snapshot_refs,
    sections: [
      {
        key: "market",
        title: "Market",
        body: `Risk regime ${riskRegimeFromAction(input.planned_action)} from snapshot ${primarySnapshot.snapshot_id}.`
      },
      {
        key: "ledger",
        title: "Ledger",
        body: `Position contains ${input.ledger_position.assets.length} assets and ${input.trade_views.length} trade views.`
      },
      {
        key: "action",
        title: "Action",
        body: `Planned action ${input.planned_action.action_type} remains ${input.planned_action.status}.`
      }
    ],
    status: "draft"
  });
}

function buildReviewId(strategyId: string, strategyVersion: string, periodStart: string): string {
  return `review_${strategyId}_${strategyVersion}_${periodStart.slice(0, 10)}`;
}

function riskRegimeFromAction(action: PlannedAction): string {
  return action.target_allocation_band_ref.endsWith("risk_on") ? "risk_on" : "neutral";
}
