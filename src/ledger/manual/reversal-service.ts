import { appendLedgerFacts, type LedgerFactCommand, type LedgerFactKind } from "@/ledger/ingest";
import { manualReversalIdempotencyKey } from "./idempotency";
import { runManualReconciliationTrigger } from "./reconcile-trigger";
import { ManualReversalCommandSchema, type ManualReversalCommand } from "./schemas";
import type { ManualWriteContext, ManualWriteSummary } from "./types";
import { assertManualReversalTargetAvailable, dimensionsFromTargetFact, requireManualTargetFact } from "./validation";

export async function submitManualReversal(
  rawCommand: ManualReversalCommand,
  context: ManualWriteContext
): Promise<ManualWriteSummary> {
  const command = ManualReversalCommandSchema.parse(rawCommand);

  if (command.target_fact_kind === "reversal") {
    throw new Error("MANUAL_REVERSAL_OF_REVERSAL_UNSUPPORTED");
  }

  const targetKind = command.target_fact_kind as LedgerFactKind;
  const target = await requireManualTargetFact(context.prismaClient, targetKind, {
    target_fact_id: command.target_fact_id,
    target_idempotency_key: command.target_idempotency_key
  });
  await assertManualReversalTargetAvailable(context.prismaClient, targetKind, target.idempotencyKey);

  const result = await appendLedgerFacts({
    batch: {
      idempotency_key: `manual_reversal_batch:${command.request_id}`,
      source_mode: "live",
      default_origin: { kind: "manual_reversal" },
      actor: context.actor,
      trigger: { kind: "manual_reversal", request_id: command.request_id },
      requested_at: command.occurred_at
    },
    facts: [reversalFact(command, targetKind, target.idempotencyKey, dimensionsFromTargetFact(target))]
  });

  return {
    result,
    reconciliationTrigger: await runManualReconciliationTrigger(result, context.afterIngest)
  };
}

function reversalFact(
  command: ManualReversalCommand,
  targetKind: LedgerFactKind,
  targetIdempotencyKey: string,
  dimensions: LedgerFactCommand["dimensions"]
): LedgerFactCommand {
  const idempotencyKey = manualReversalIdempotencyKey(targetKind, targetIdempotencyKey, command.request_id);

  return {
    kind: "reversal",
    idempotency_key: idempotencyKey,
    natural_key: `manual:reversal:${targetKind}:${targetIdempotencyKey}:${command.request_id}`,
    origin: { kind: "manual_reversal" },
    occurred_at: command.occurred_at,
    dimensions,
    payload: {
      target_fact_kind: targetKind,
      target_fact_idempotency_key: targetIdempotencyKey,
      reason_code: command.reason_code,
      note: command.note
    }
  };
}
