import { addDecimal, negateDecimal, subtractDecimal } from "./decimal";
import type { LedgerReplayEvent, LedgerReplayOutput, ReplayDiagnostic, TradeFillReplayEvent } from "./types";

export type ReplayLedgerFactsOptions = {
  asOf?: string;
};

export function replayLedgerFacts(events: readonly LedgerReplayEvent[], _options: ReplayLedgerFactsOptions = {}): LedgerReplayOutput {
  const accountBalances: Record<string, Record<string, string>> = {};
  const strategyPositions: Record<string, Record<string, string>> = {};
  const unassigned: Record<string, Record<string, string>> = {};
  const diagnostics: ReplayDiagnostic[] = [];
  const effectByFact = new Map<string, () => void>();
  const reversedTargets = new Set<string>();

  for (const event of events) {
    if (event.kind === "reversal") {
      const reversal = effectByFact.get(event.targetFactIdempotencyKey);
      if (!reversal) {
        diagnostics.push({
          code: "REVERSAL_TARGET_NOT_IN_REPLAY",
          message: `Reversal target ${event.targetFactIdempotencyKey} was not present in replay scope`,
          severity: "warn",
          factIdempotencyKey: event.idempotencyKey
        });
        continue;
      }

      reversal();
      reversedTargets.add(event.targetFactIdempotencyKey);
      continue;
    }

    if (reversedTargets.has(event.idempotencyKey)) {
      continue;
    }

    const rollback = applyEvent(accountBalances, strategyPositions, unassigned, diagnostics, event);
    effectByFact.set(event.idempotencyKey, rollback);
  }

  return {
    accountBalances: pruneZeroBalances(accountBalances),
    strategyPositions: pruneZeroBalances(strategyPositions),
    lots: {},
    realizedPnl: {},
    unassigned: pruneZeroBalances(unassigned),
    diagnostics
  };
}

function applyEvent(
  accountBalances: Record<string, Record<string, string>>,
  strategyPositions: Record<string, Record<string, string>>,
  unassigned: Record<string, Record<string, string>>,
  diagnostics: ReplayDiagnostic[],
  event: LedgerReplayEvent
): () => void {
  const deltas: Array<() => void> = [];
  const applyAccount = (accountId: string, asset: string, delta: string) => {
    addNestedBalance(accountBalances, accountId, asset, delta);
    deltas.push(() => addNestedBalance(accountBalances, accountId, asset, negateDecimal(delta)));
  };
  const applyStrategy = (strategyId: string, asset: string, delta: string) => {
    addNestedBalance(strategyPositions, strategyId, asset, delta);
    deltas.push(() => addNestedBalance(strategyPositions, strategyId, asset, negateDecimal(delta)));
  };
  const applyUnassigned = (accountId: string, asset: string, delta: string) => {
    addNestedBalance(unassigned, accountId, asset, delta);
    deltas.push(() => addNestedBalance(unassigned, accountId, asset, negateDecimal(delta)));
  };

  switch (event.kind) {
    case "trade_fill": {
      applyTradeFill(event, applyAccount, applyStrategy, applyUnassigned);
      break;
    }
    case "capital_flow": {
      const delta = event.flowType === "withdrawal" || event.flowType === "transfer_out" ? negateDecimal(event.amount) : event.amount;
      applyAccount(event.accountId, event.asset, delta);
      applyUnassigned(event.accountId, event.asset, delta);
      break;
    }
    case "external_trade": {
      const delta = event.side === "BUY" ? event.amount : negateDecimal(event.amount);
      applyAccount(event.accountId, event.asset, delta);
      if (event.strategyId) {
        applyStrategy(event.strategyId, event.asset, delta);
      } else {
        applyUnassigned(event.accountId, event.asset, delta);
      }
      break;
    }
    case "attribution":
      break;
    case "reversal":
      break;
    default:
      diagnostics.push({
        code: "UNSUPPORTED_REPLAY_EVENT",
        message: `Unsupported replay event ${(event as LedgerReplayEvent).kind}`,
        severity: "warn"
      });
  }

  return () => {
    for (const rollback of [...deltas].reverse()) {
      rollback();
    }
  };
}

function applyTradeFill(
  event: TradeFillReplayEvent,
  applyAccount: (accountId: string, asset: string, delta: string) => void,
  applyStrategy: (strategyId: string, asset: string, delta: string) => void,
  applyUnassigned: (accountId: string, asset: string, delta: string) => void
) {
  const baseQty = event.side === "BUY" ? event.qty : negateDecimal(event.qty);
  const quoteQty = event.side === "BUY" ? negateDecimal(event.quoteQty) : event.quoteQty;
  const baseDelta = event.commissionAsset === event.baseAsset ? subtractDecimal(baseQty, event.commission) : baseQty;
  const quoteDelta = event.commissionAsset === event.quoteAsset ? subtractDecimal(quoteQty, event.commission) : quoteQty;

  applyAccount(event.accountId, event.baseAsset, baseDelta);
  applyAccount(event.accountId, event.quoteAsset, quoteDelta);

  if (event.commissionAsset !== event.baseAsset && event.commissionAsset !== event.quoteAsset) {
    applyAccount(event.accountId, event.commissionAsset, negateDecimal(event.commission));
  }

  if (event.strategyId) {
    applyStrategy(event.strategyId, event.baseAsset, baseDelta);
    applyStrategy(event.strategyId, event.quoteAsset, quoteDelta);
    if (event.commissionAsset !== event.baseAsset && event.commissionAsset !== event.quoteAsset) {
      applyStrategy(event.strategyId, event.commissionAsset, negateDecimal(event.commission));
    }
  } else {
    applyUnassigned(event.accountId, event.baseAsset, baseDelta);
    applyUnassigned(event.accountId, event.quoteAsset, quoteDelta);
  }
}

function addNestedBalance(target: Record<string, Record<string, string>>, scope: string, asset: string, delta: string) {
  target[scope] ??= {};
  target[scope][asset] = addDecimal(target[scope][asset] ?? "0.00000000", delta);
}

function pruneZeroBalances(target: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
  const pruned: Record<string, Record<string, string>> = {};

  for (const [scope, balances] of Object.entries(target)) {
    const nonZero = Object.fromEntries(Object.entries(balances).filter(([, value]) => value !== "0.00000000"));
    if (Object.keys(nonZero).length > 0) {
      pruned[scope] = nonZero;
    }
  }

  return pruned;
}
