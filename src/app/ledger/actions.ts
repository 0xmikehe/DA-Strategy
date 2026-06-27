"use server";

import { submitManualAttribution } from "@/ledger/manual/attribution-service";
import { submitManualExternalTrade } from "@/ledger/manual/external-trade-service";
import { submitManualReversal } from "@/ledger/manual/reversal-service";
import type {
  ManualAttributionCommand,
  ManualExternalTradeCommand,
  ManualReversalCommand
} from "@/ledger/manual/schemas";
import { runLedgerReconciliation } from "@/ledger/reconciliation/run";
import { prisma } from "@/server/db/prisma";
import { revalidatePath } from "next/cache";

const ledgerPageActor = { kind: "user" as const, user_id: "ledger_page_operator" };

export async function requestLedgerSync() {
  return {
    ok: false,
    status: "unavailable" as const,
    message: "Live Binance sync is not enabled in the offline P2 page loop."
  };
}

export async function requestLedgerReconciliation(input?: { runId?: string; asOf?: string; checkedAt?: string }) {
  const checkedAt = input?.checkedAt ?? new Date().toISOString();
  const summary = await runLedgerReconciliation({
    prismaClient: prisma,
    runId: input?.runId ?? `page_reconciliation:${checkedAt}`,
    asOf: input?.asOf,
    checkedAt
  });
  revalidatePath("/ledger");

  return {
    ok: true,
    runId: summary.runId,
    written: summary.written,
    resultCount: summary.results.length
  };
}

export async function submitLedgerAttribution(command: ManualAttributionCommand) {
  const summary = await submitManualAttribution(command, {
    prismaClient: prisma,
    actor: ledgerPageActor
  });
  revalidatePath("/ledger");

  return {
    ok: true,
    batchId: summary.result.batch_id,
    inserted: summary.result.inserted
  };
}

export async function submitLedgerExternalTrade(command: ManualExternalTradeCommand) {
  const summary = await submitManualExternalTrade(command, {
    prismaClient: prisma,
    actor: ledgerPageActor
  });
  revalidatePath("/ledger");

  return {
    ok: true,
    batchId: summary.result.batch_id,
    inserted: summary.result.inserted
  };
}

export async function submitLedgerReversal(command: ManualReversalCommand) {
  const summary = await submitManualReversal(command, {
    prismaClient: prisma,
    actor: ledgerPageActor
  });
  revalidatePath("/ledger");

  return {
    ok: true,
    batchId: summary.result.batch_id,
    inserted: summary.result.inserted
  };
}

export async function submitLedgerAttributionForm(formData: FormData) {
  const targetIdempotencyKey = requiredFormValue(formData, "target_idempotency_key");
  const assignmentKind = requiredFormValue(formData, "assignment_kind") as ManualAttributionCommand["assignment_kind"];
  const strategyId = optionalFormValue(formData, "strategy_id");
  const strategyVersion = optionalFormValue(formData, "strategy_version");

  await submitLedgerAttribution({
    request_id: `page_attr_${Date.now()}`,
    target_fact_kind: requiredFormValue(formData, "target_fact_kind") as ManualAttributionCommand["target_fact_kind"],
    target_idempotency_key: targetIdempotencyKey,
    assignment_kind: assignmentKind,
    strategy_id: assignmentKind === "strategy" ? strategyId : undefined,
    strategy_version: assignmentKind === "strategy" ? strategyVersion : undefined,
    reason_code: requiredFormValue(formData, "reason_code"),
    occurred_at: new Date().toISOString()
  });
}

export async function submitLedgerReversalForm(formData: FormData) {
  await submitLedgerReversal({
    request_id: `page_rev_${Date.now()}`,
    target_fact_kind: requiredFormValue(formData, "target_fact_kind") as ManualReversalCommand["target_fact_kind"],
    target_idempotency_key: requiredFormValue(formData, "target_idempotency_key"),
    reason_code: requiredFormValue(formData, "reason_code"),
    note: requiredFormValue(formData, "note"),
    occurred_at: new Date().toISOString()
  });
}

export async function submitLedgerExternalTradeForm(formData: FormData) {
  const strategyId = optionalFormValue(formData, "strategy_id");
  const strategyVersion = optionalFormValue(formData, "strategy_version");

  await submitLedgerExternalTrade({
    request_id: `page_ext_${Date.now()}`,
    wallet_account_id: requiredFormValue(formData, "wallet_account_id"),
    side: requiredFormValue(formData, "side") as ManualExternalTradeCommand["side"],
    base_asset: requiredFormValue(formData, "base_asset"),
    quote_asset: requiredFormValue(formData, "quote_asset"),
    base_qty: requiredFormValue(formData, "base_qty"),
    price: optionalFormValue(formData, "price"),
    quote_qty: optionalFormValue(formData, "quote_qty"),
    occurred_at: requiredFormValue(formData, "occurred_at"),
    fee_qty: optionalFormValue(formData, "fee_qty"),
    fee_asset: optionalFormValue(formData, "fee_asset"),
    tx_id: optionalFormValue(formData, "tx_id"),
    venue: optionalFormValue(formData, "venue"),
    note: optionalFormValue(formData, "note"),
    strategy_id: strategyId,
    strategy_version: strategyId ? strategyVersion : undefined
  });
}

function requiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`LEDGER_PAGE_FORM_FIELD_REQUIRED:${key}`);
  }

  return value;
}

function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
