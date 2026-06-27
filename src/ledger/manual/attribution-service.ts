import { appendLedgerFacts, type LedgerFactCommand } from "@/ledger/ingest";
import { manualAttributionIdempotencyKey } from "./idempotency";
import { runManualReconciliationTrigger } from "./reconcile-trigger";
import { ManualAttributionCommandSchema, type ManualAttributionCommand } from "./schemas";
import type { ManualWriteContext, ManualWriteSummary } from "./types";
import { dimensionsFromTargetFact, requireManualTargetFact } from "./validation";

export async function submitManualAttribution(
  rawCommand: ManualAttributionCommand,
  context: ManualWriteContext
): Promise<ManualWriteSummary> {
  const result = await submitManualAttributionBatch([rawCommand], context);

  return result;
}

export async function submitManualAttributionBatch(
  rawCommands: ManualAttributionCommand[],
  context: ManualWriteContext
): Promise<ManualWriteSummary> {
  const commands = rawCommands.map((rawCommand) => ManualAttributionCommandSchema.parse(rawCommand));

  if (commands.length === 0) {
    throw new Error("MANUAL_ATTRIBUTION_COMMAND_REQUIRED");
  }

  const facts: LedgerFactCommand[] = [];
  for (const command of commands) {
    const target = await requireManualTargetFact(context.prismaClient, command.target_fact_kind, {
      target_fact_id: command.target_fact_id,
      target_idempotency_key: command.target_idempotency_key
    });
    facts.push(attributionFact(command, target.idempotencyKey, dimensionsFromTargetFact(target, strategyDimensions(command))));
  }

  const requestIds = commands.map((command) => command.request_id).join(",");
  const requestedAt = commands.map((command) => command.occurred_at).sort()[0];
  const result = await appendLedgerFacts({
    batch: {
      idempotency_key: `manual_attribution_batch:${requestIds}`,
      source_mode: "live",
      default_origin: { kind: "manual_attribution" },
      actor: context.actor,
      trigger: { kind: "manual_attribution", request_id: requestIds },
      requested_at: requestedAt
    },
    facts
  });

  return {
    result,
    reconciliationTrigger: await runManualReconciliationTrigger(result, context.afterIngest)
  };
}

function attributionFact(
  command: ManualAttributionCommand,
  targetIdempotencyKey: string,
  dimensions: LedgerFactCommand["dimensions"]
): LedgerFactCommand {
  const idempotencyKey = manualAttributionIdempotencyKey(
    command.target_fact_kind,
    targetIdempotencyKey,
    command.request_id
  );

  return {
    kind: "attribution_record",
    idempotency_key: idempotencyKey,
    natural_key: `manual:attribution:${targetIdempotencyKey}:${command.request_id}`,
    origin: { kind: "manual_attribution" },
    occurred_at: command.occurred_at,
    dimensions,
    payload: {
      target_fact_kind: command.target_fact_kind,
      target_idempotency_key: targetIdempotencyKey,
      assignment_kind: command.assignment_kind,
      reason_code: command.reason_code,
      strategy_id: command.strategy_id,
      strategy_version: command.strategy_version,
      note: command.note
    }
  };
}

function strategyDimensions(command: ManualAttributionCommand) {
  if (command.assignment_kind !== "strategy") {
    return undefined;
  }

  return {
    strategy_id: command.strategy_id,
    strategy_version: command.strategy_version
  };
}
