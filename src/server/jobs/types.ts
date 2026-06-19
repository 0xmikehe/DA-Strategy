export const jobTypes = [
  "ledger_sync",
  "signal_fact_collect",
  "signal_snapshot_build",
  "strategy_review_draft"
] as const;

export type JobTypeName = (typeof jobTypes)[number];
