export const ledgerModule = {
  layer: "ledger",
  owner: "facts-layer",
  phase: "phase1-p0",
  responsibility: "account facts, append-only events, reconciliation, and snapshot containers"
} as const;

export * from "./ingest";
