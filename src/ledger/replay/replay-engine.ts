import { addDecimal, negateDecimal, subtractDecimal } from "./decimal";
import type {
  AttributionReplayEvent,
  LedgerReplayEvent,
  LedgerReplayOutput,
  ReplayDiagnostic,
  TradeFillReplayEvent
} from "./types";

export type ReplayLedgerFactsOptions = {
  asOf?: string;
};

export function replayLedgerFacts(events: readonly LedgerReplayEvent[], options: ReplayLedgerFactsOptions = {}): LedgerReplayOutput {
  void options;

  const accountBalances: Record<string, Record<string, string>> = {};
  const strategyPositions: Record<string, Record<string, string>> = {};
  const unassigned: Record<string, Record<string, string>> = {};
  const diagnostics: ReplayDiagnostic[] = [];
  const effectByFact = new Map<string, AppliedReplayEffect>();
  const reversedTargets = new Set<string>();

  for (const event of events) {
    if (event.kind === "reversal") {
      const effect = effectByFact.get(event.targetFactIdempotencyKey);
      if (!effect) {
        diagnostics.push({
          code: "REVERSAL_TARGET_NOT_IN_REPLAY",
          message: `Reversal target ${event.targetFactIdempotencyKey} was not present in replay scope`,
          severity: "warn",
          factIdempotencyKey: event.idempotencyKey
        });
        continue;
      }

      effect.reverse();
      reversedTargets.add(event.targetFactIdempotencyKey);
      continue;
    }

    if (event.kind === "attribution") {
      applyAttribution(event, effectByFact, diagnostics);
      continue;
    }

    if (reversedTargets.has(event.idempotencyKey)) {
      continue;
    }

    const effect = applyEvent(accountBalances, strategyPositions, unassigned, diagnostics, event);
    effectByFact.set(event.idempotencyKey, effect);
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

type AssetDelta = {
  asset: string;
  delta: string;
};

type AttributionAssignment =
  | { kind: "strategy"; strategyId: string }
  | { kind: "unassigned"; accountId?: string }
  | { kind: "external" };

type AllocationEffect = {
  assign: (assignment: AttributionAssignment) => AttributionAssignment | undefined;
  current: () => AttributionAssignment | undefined;
  reverse: () => void;
  isReversed: () => boolean;
};

type AppliedReplayEffect = {
  reverse: () => void;
  allocation?: AllocationEffect;
};

function applyEvent(
  accountBalances: Record<string, Record<string, string>>,
  strategyPositions: Record<string, Record<string, string>>,
  unassigned: Record<string, Record<string, string>>,
  diagnostics: ReplayDiagnostic[],
  event: LedgerReplayEvent
): AppliedReplayEffect {
  let accountId: string | undefined;
  let accountDeltas: AssetDelta[] = [];
  let allocationDeltas: AssetDelta[] = [];
  let initialAssignment: AttributionAssignment | undefined;

  switch (event.kind) {
    case "trade_fill": {
      accountId = event.accountId;
      accountDeltas = tradeFillDeltas(event);
      allocationDeltas = accountDeltas;
      initialAssignment = event.strategyId
        ? { kind: "strategy", strategyId: event.strategyId }
        : { kind: "unassigned", accountId: event.accountId };
      break;
    }
    case "capital_flow": {
      const delta = event.flowType === "withdrawal" || event.flowType === "transfer_out" ? negateDecimal(event.amount) : event.amount;
      accountId = event.accountId;
      accountDeltas = [{ asset: event.asset, delta }];
      allocationDeltas = accountDeltas;
      initialAssignment = { kind: "unassigned", accountId: event.accountId };
      break;
    }
    case "external_trade": {
      const delta = event.side === "BUY" ? event.amount : negateDecimal(event.amount);
      accountId = event.accountId;
      accountDeltas = [{ asset: event.asset, delta }];
      allocationDeltas = accountDeltas;
      initialAssignment = event.strategyId
        ? { kind: "strategy", strategyId: event.strategyId }
        : { kind: "unassigned", accountId: event.accountId };
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

  if (accountId) {
    applyAssetDeltas(accountBalances, accountId, accountDeltas);
  }

  const allocation =
    initialAssignment && allocationDeltas.length > 0
      ? createAllocationEffect(strategyPositions, unassigned, allocationDeltas, initialAssignment, accountId)
      : undefined;

  return {
    allocation,
    reverse() {
      if (accountId) {
        removeAssetDeltas(accountBalances, accountId, accountDeltas);
      }
      allocation?.reverse();
    }
  };
}

function applyAttribution(
  event: AttributionReplayEvent,
  effectByFact: Map<string, AppliedReplayEffect>,
  diagnostics: ReplayDiagnostic[]
) {
  if (!event.targetIdempotencyKey) {
    diagnostics.push({
      code: "ATTRIBUTION_TARGET_REQUIRED",
      message: "Attribution record is missing target idempotency key",
      severity: "warn",
      factIdempotencyKey: event.idempotencyKey
    });
    return;
  }

  const targetEffect = effectByFact.get(event.targetIdempotencyKey);
  if (!targetEffect?.allocation) {
    diagnostics.push({
      code: "ATTRIBUTION_TARGET_NOT_IN_REPLAY",
      message: `Attribution target ${event.targetIdempotencyKey} was not present in replay scope`,
      severity: "warn",
      factIdempotencyKey: event.idempotencyKey
    });
    return;
  }

  if (targetEffect.allocation.isReversed()) {
    return;
  }

  const assignment = attributionAssignment(event);
  if (!assignment) {
    diagnostics.push({
      code: "ATTRIBUTION_ASSIGNMENT_UNSUPPORTED",
      message: `Unsupported attribution assignment ${event.assignmentKind ?? "<missing>"}`,
      severity: "warn",
      factIdempotencyKey: event.idempotencyKey
    });
    return;
  }

  const previousAssignment = targetEffect.allocation.assign(assignment);
  const appliedAssignment = targetEffect.allocation.current();
  effectByFact.set(event.idempotencyKey, {
    reverse() {
      const allocation = targetEffect.allocation;
      if (!allocation || allocation.isReversed() || !appliedAssignment) {
        return;
      }

      if (sameAssignment(allocation.current(), appliedAssignment) && previousAssignment) {
        allocation.assign(previousAssignment);
      }
    }
  });
}

function attributionAssignment(event: AttributionReplayEvent): AttributionAssignment | undefined {
  switch (event.assignmentKind) {
    case "strategy":
      return event.strategyId ? { kind: "strategy", strategyId: event.strategyId } : undefined;
    case "external":
      return { kind: "external" };
    case "unassigned":
      return { kind: "unassigned" };
    default:
      return undefined;
  }
}

function createAllocationEffect(
  strategyPositions: Record<string, Record<string, string>>,
  unassigned: Record<string, Record<string, string>>,
  deltas: AssetDelta[],
  initialAssignment: AttributionAssignment,
  fallbackAccountId: string | undefined
): AllocationEffect {
  let currentAssignment: AttributionAssignment | undefined;
  let reversed = false;
  const unassignedAccountId = fallbackAccountId ?? (initialAssignment.kind === "unassigned" ? initialAssignment.accountId : undefined);

  const applyAssignment = (assignment: AttributionAssignment, sign: "apply" | "remove") => {
    const signedDeltas = sign === "apply" ? deltas : deltas.map((delta) => ({ ...delta, delta: negateDecimal(delta.delta) }));

    switch (assignment.kind) {
      case "strategy":
        applyAssetDeltas(strategyPositions, assignment.strategyId, signedDeltas);
        break;
      case "unassigned":
        applyAssetDeltas(unassigned, assignment.accountId ?? unassignedAccountId ?? "unknown_account", signedDeltas);
        break;
      case "external":
        break;
    }
  };

  const assign = (assignment: AttributionAssignment) => {
    if (reversed) {
      return currentAssignment;
    }

    const previousAssignment = currentAssignment;
    if (currentAssignment) {
      applyAssignment(currentAssignment, "remove");
    }

    currentAssignment =
      assignment.kind === "unassigned" && !assignment.accountId && unassignedAccountId
        ? { ...assignment, accountId: unassignedAccountId }
        : assignment;
    applyAssignment(currentAssignment, "apply");
    return previousAssignment;
  };

  assign(initialAssignment);

  return {
    assign,
    current() {
      return currentAssignment;
    },
    reverse() {
      if (reversed) {
        return;
      }

      if (currentAssignment) {
        applyAssignment(currentAssignment, "remove");
      }
      currentAssignment = undefined;
      reversed = true;
    },
    isReversed() {
      return reversed;
    }
  };
}

function sameAssignment(left: AttributionAssignment | undefined, right: AttributionAssignment | undefined): boolean {
  if (!left || !right || left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "strategy":
      return right.kind === "strategy" && left.strategyId === right.strategyId;
    case "unassigned":
      return right.kind === "unassigned" && left.accountId === right.accountId;
    case "external":
      return true;
  }
}

function tradeFillDeltas(event: TradeFillReplayEvent): AssetDelta[] {
  const baseQty = event.side === "BUY" ? event.qty : negateDecimal(event.qty);
  const quoteQty = event.side === "BUY" ? negateDecimal(event.quoteQty) : event.quoteQty;
  const baseDelta = event.commissionAsset === event.baseAsset ? subtractDecimal(baseQty, event.commission) : baseQty;
  const quoteDelta = event.commissionAsset === event.quoteAsset ? subtractDecimal(quoteQty, event.commission) : quoteQty;
  const deltas: AssetDelta[] = [
    { asset: event.baseAsset, delta: baseDelta },
    { asset: event.quoteAsset, delta: quoteDelta }
  ];

  if (event.commissionAsset !== event.baseAsset && event.commissionAsset !== event.quoteAsset) {
    deltas.push({ asset: event.commissionAsset, delta: negateDecimal(event.commission) });
  }

  return deltas;
}

function applyAssetDeltas(target: Record<string, Record<string, string>>, scope: string, deltas: AssetDelta[]) {
  for (const delta of deltas) {
    addNestedBalance(target, scope, delta.asset, delta.delta);
  }
}

function removeAssetDeltas(target: Record<string, Record<string, string>>, scope: string, deltas: AssetDelta[]) {
  for (const delta of [...deltas].reverse()) {
    addNestedBalance(target, scope, delta.asset, negateDecimal(delta.delta));
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
