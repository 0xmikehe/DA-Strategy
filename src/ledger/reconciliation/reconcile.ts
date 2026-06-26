import {
  absDecimalString,
  compareDecimalStrings,
  subtractDecimalStrings
} from "./decimal";
import type { ReconciliationInput, ReconciliationResultRecord } from "./types";

export function classifyReconciliation(input: ReconciliationInput): ReconciliationResultRecord {
  if (input.reportedQty === undefined || input.snapshotRef === undefined) {
    return {
      ...input,
      diffQty: input.computedQty,
      status: "NEEDS_CLASSIFICATION",
      note: "missing reported snapshot"
    };
  }

  const diffQty = subtractDecimalStrings(input.computedQty, input.reportedQty);

  if (input.diagnostics.length > 0) {
    return {
      ...input,
      diffQty,
      status: "NEEDS_CLASSIFICATION",
      note: "replay diagnostics require classification"
    };
  }

  if (compareDecimalStrings(absDecimalString(diffQty), input.thresholdQty) <= 0) {
    return {
      ...input,
      diffQty,
      status: "MATCHED"
    };
  }

  if (compareDecimalStrings(input.reportedQty, input.computedQty) > 0) {
    return {
      ...input,
      diffQty,
      status: "MISSING_EVENT"
    };
  }

  return {
    ...input,
    diffQty,
    status: "EXTERNAL_BALANCE_MISMATCH"
  };
}
