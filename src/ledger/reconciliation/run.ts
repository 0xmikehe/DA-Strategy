import type { PrismaClient } from "@prisma/client";
import { readLedgerReplayInputs } from "@/ledger/replay/event-reader";
import { replayLedgerFacts } from "@/ledger/replay/replay-engine";
import { classifyReconciliation } from "./reconcile";
import { writeReconciliationResults } from "./result-writer";
import type { ReconciliationResultRecord } from "./types";

export type RunLedgerReconciliationInput = {
  prismaClient: PrismaClient;
  runId: string;
  asOf?: string;
  checkedAt: string;
  thresholdByAsset?: Record<string, string>;
};

export type RunLedgerReconciliationResult = {
  runId: string;
  checkedAt: string;
  results: ReconciliationResultRecord[];
  written: number;
};

const DEFAULT_THRESHOLD = "0.00000001";

export async function runLedgerReconciliation(input: RunLedgerReconciliationInput): Promise<RunLedgerReconciliationResult> {
  const replayInputs = await readLedgerReplayInputs({
    prismaClient: input.prismaClient,
    asOf: input.asOf
  });
  const replay = replayLedgerFacts(replayInputs.events, { asOf: input.asOf });
  const results = replayInputs.reportedSnapshots.map((snapshot) =>
    classifyReconciliation({
      runId: input.runId,
      accountId: snapshot.accountId,
      asset: snapshot.asset,
      computedQty: replay.accountBalances[snapshot.accountId]?.[snapshot.asset] ?? "0.00000000",
      reportedQty: snapshot.reportedQty,
      thresholdQty: input.thresholdByAsset?.[snapshot.asset] ?? DEFAULT_THRESHOLD,
      snapshotRef: snapshot.snapshotRef,
      checkedAt: input.checkedAt,
      diagnostics: replay.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: diagnostic.severity
      }))
    })
  );

  const writeResult = await writeReconciliationResults({
    results,
    prismaClient: input.prismaClient
  });

  return {
    runId: input.runId,
    checkedAt: input.checkedAt,
    results,
    written: writeResult.inserted
  };
}
