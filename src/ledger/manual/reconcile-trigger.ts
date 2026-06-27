import type { ManualWriteContext, ManualWriteSummary } from "./types";

export async function runManualReconciliationTrigger(
  result: ManualWriteSummary["result"],
  afterIngest: ManualWriteContext["afterIngest"]
): Promise<ManualWriteSummary["reconciliationTrigger"]> {
  if (!afterIngest) {
    return undefined;
  }

  try {
    await afterIngest(result);
    return { attempted: true, ok: true };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}
