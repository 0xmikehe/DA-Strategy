import type { PrismaClient } from "@prisma/client";
import type { ReconciliationResultRecord } from "./types";

export type WriteReconciliationResultsInput = {
  results: ReconciliationResultRecord[];
  prismaClient: PrismaClient;
};

export async function writeReconciliationResults(input: WriteReconciliationResultsInput): Promise<{ inserted: number }> {
  for (const result of input.results) {
    await input.prismaClient.reconciliationResult.create({
      data: {
        runId: result.runId,
        accountId: result.accountId,
        asset: result.asset,
        computedQty: result.computedQty,
        reportedQty: result.reportedQty,
        diffQty: result.diffQty,
        thresholdQty: result.thresholdQty,
        status: result.status,
        snapshotRef: result.snapshotRef,
        checkedAt: new Date(result.checkedAt),
        note: result.note,
        diagnosticsJson: result.diagnostics
      }
    });
  }

  return { inserted: input.results.length };
}
