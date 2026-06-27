import { appendLedgerFacts, type LedgerFactCommand } from "@/ledger/ingest";
import { multiplyDecimalStrings } from "./decimal";
import { manualAttributionIdempotencyKey, manualExternalTradeIdempotencyKey } from "./idempotency";
import { runManualReconciliationTrigger } from "./reconcile-trigger";
import { ManualExternalTradeCommandSchema, type ManualExternalTradeCommand } from "./schemas";
import type { ManualWriteContext, ManualWriteSummary } from "./types";

export async function submitManualExternalTrade(
  rawCommand: ManualExternalTradeCommand,
  context: ManualWriteContext
): Promise<ManualWriteSummary> {
  const command = ManualExternalTradeCommandSchema.parse(rawCommand);
  const externalTradeKey = manualExternalTradeIdempotencyKey(command.request_id);
  const facts: LedgerFactCommand[] = [externalTradeFact(command, externalTradeKey)];

  if (command.strategy_id && command.strategy_version) {
    facts.push(attributionFact(command, externalTradeKey));
  }

  const result = await appendLedgerFacts({
    batch: {
      idempotency_key: `manual_external_trade_batch:${command.request_id}`,
      source_mode: "live",
      default_origin: { kind: "manual_external_trade" },
      actor: context.actor,
      trigger: { kind: "manual_entry", request_id: command.request_id },
      requested_at: command.occurred_at
    },
    facts
  });

  return {
    result,
    reconciliationTrigger: await runManualReconciliationTrigger(result, context.afterIngest)
  };
}

function externalTradeFact(command: ManualExternalTradeCommand, idempotencyKey: string): LedgerFactCommand {
  const quoteQty = command.quote_qty ?? multiplyDecimalStrings(command.price ?? "0", command.base_qty);

  return {
    kind: "external_trade",
    idempotency_key: idempotencyKey,
    natural_key: `manual:external_trade:${command.request_id}`,
    origin: { kind: "manual_external_trade" },
    occurred_at: command.occurred_at,
    payload: {
      exchange_account_id: command.wallet_account_id,
      external_id: command.request_id,
      asset: command.base_asset,
      base_asset: command.base_asset,
      quote_asset: command.quote_asset,
      side: command.side.toUpperCase(),
      amount: command.base_qty,
      quote_qty: quoteQty,
      price: command.price,
      fee_qty: command.fee_qty,
      fee_asset: command.fee_asset,
      tx_id: command.tx_id,
      venue: command.venue,
      note: command.note,
      strategy_id: command.strategy_id,
      strategy_version: command.strategy_version,
      attribution_status: command.strategy_id ? "strategy_assigned" : "pending"
    }
  };
}

function attributionFact(command: ManualExternalTradeCommand, targetIdempotencyKey: string): LedgerFactCommand {
  const idempotencyKey = manualAttributionIdempotencyKey("external_trade", targetIdempotencyKey, command.request_id);

  return {
    kind: "attribution_record",
    idempotency_key: idempotencyKey,
    natural_key: `manual:attribution:${targetIdempotencyKey}:${command.request_id}`,
    origin: { kind: "manual_attribution" },
    occurred_at: command.occurred_at,
    payload: {
      target_fact_kind: "external_trade",
      target_idempotency_key: targetIdempotencyKey,
      assignment_kind: "strategy",
      reason_code: "manual_external_trade_entry",
      strategy_id: command.strategy_id,
      strategy_version: command.strategy_version
    }
  };
}
