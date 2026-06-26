export const reconciliationStatuses = [
  "MATCHED",
  "MISSING_EVENT",
  "EXTERNAL_BALANCE_MISMATCH",
  "NEEDS_CLASSIFICATION"
] as const;

export type ReconciliationStatus = (typeof reconciliationStatuses)[number];

export type ReconciliationDiagnostic = {
  code: string;
  message: string;
  severity?: "info" | "warn" | "error";
};

export type ReconciliationInput = {
  runId: string;
  accountId: string;
  asset: string;
  computedQty: string;
  reportedQty?: string;
  thresholdQty: string;
  snapshotRef?: string;
  checkedAt: string;
  diagnostics: ReconciliationDiagnostic[];
};

export type ReconciliationResultRecord = ReconciliationInput & {
  diffQty: string;
  status: ReconciliationStatus;
  note?: string;
};
