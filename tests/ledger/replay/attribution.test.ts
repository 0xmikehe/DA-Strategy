import { describe, expect, it } from "vitest";
import { replayLedgerFacts } from "@/ledger/replay/replay-engine";
import type { LedgerReplayEvent } from "@/ledger/replay/types";

describe("replay attribution effects", () => {
  it("moves external trade exposure from unassigned to strategy without changing account balance", () => {
    const replay = replayLedgerFacts([
      externalTrade("manual_external_trade:req_ext_pending"),
      attribution("manual_external_trade:req_ext_pending", "core_allocation_lt", "v1")
    ]);

    expect(replay.accountBalances).toEqual({
      wallet_1: {
        BTC: "0.01000000"
      }
    });
    expect(replay.strategyPositions).toEqual({
      core_allocation_lt: {
        BTC: "0.01000000"
      }
    });
    expect(replay.unassigned).toEqual({});
    expect(replay.diagnostics).toEqual([]);
  });

  it("uses the latest attribution as the effective projection", () => {
    const replay = replayLedgerFacts([
      externalTrade("manual_external_trade:req_ext_reattr"),
      attribution("manual_external_trade:req_ext_reattr", "core_allocation_lt", "v1"),
      {
        kind: "attribution",
        idempotencyKey: "manual_attribution:external_trade:manual_external_trade:req_ext_reattr:req_attr_unassigned",
        naturalKey: "manual:attribution:manual_external_trade:req_ext_reattr:req_attr_unassigned",
        occurredAt: "2026-06-25T00:14:00.000Z",
        targetIdempotencyKey: "manual_external_trade:req_ext_reattr",
        assignmentKind: "unassigned"
      }
    ]);

    expect(replay.accountBalances).toEqual({
      wallet_1: {
        BTC: "0.01000000"
      }
    });
    expect(replay.strategyPositions).toEqual({});
    expect(replay.unassigned).toEqual({
      wallet_1: {
        BTC: "0.01000000"
      }
    });
    expect(replay.diagnostics).toEqual([]);
  });

  it("reversal of an attribution restores the prior projection", () => {
    const replay = replayLedgerFacts([
      externalTrade("manual_external_trade:req_ext_attr_reversal"),
      attribution("manual_external_trade:req_ext_attr_reversal", "core_allocation_lt", "v1"),
      {
        kind: "reversal",
        idempotencyKey: "manual_reversal:attribution_record:manual_attribution:external_trade:manual_external_trade:req_ext_attr_reversal:req_attr_strategy:req_rev_attr",
        naturalKey: "manual:reversal:attr",
        occurredAt: "2026-06-25T00:14:00.000Z",
        targetFactKind: "attribution_record",
        targetFactIdempotencyKey: "manual_attribution:external_trade:manual_external_trade:req_ext_attr_reversal:req_attr_strategy"
      }
    ]);

    expect(replay.accountBalances).toEqual({
      wallet_1: {
        BTC: "0.01000000"
      }
    });
    expect(replay.strategyPositions).toEqual({});
    expect(replay.unassigned).toEqual({
      wallet_1: {
        BTC: "0.01000000"
      }
    });
    expect(replay.diagnostics).toEqual([]);
  });

  it("reports orphan attribution without hiding account facts", () => {
    const replay = replayLedgerFacts([attribution("missing_target", "core_allocation_lt", "v1")]);

    expect(replay.accountBalances).toEqual({});
    expect(replay.strategyPositions).toEqual({});
    expect(replay.unassigned).toEqual({});
    expect(replay.diagnostics).toEqual([
      expect.objectContaining({
        code: "ATTRIBUTION_TARGET_NOT_IN_REPLAY",
        factIdempotencyKey: "manual_attribution:external_trade:missing_target:req_attr_strategy"
      })
    ]);
  });
});

function externalTrade(idempotencyKey: string): LedgerReplayEvent {
  return {
    kind: "external_trade",
    idempotencyKey,
    naturalKey: `manual:external_trade:${idempotencyKey}`,
    occurredAt: "2026-06-25T00:12:00.000Z",
    accountId: "wallet_1",
    asset: "BTC",
    side: "BUY",
    amount: "0.01000000"
  };
}

function attribution(targetIdempotencyKey: string, strategyId: string, strategyVersion: string): LedgerReplayEvent {
  return {
    kind: "attribution",
    idempotencyKey: `manual_attribution:external_trade:${targetIdempotencyKey}:req_attr_strategy`,
    naturalKey: `manual:attribution:${targetIdempotencyKey}:req_attr_strategy`,
    occurredAt: "2026-06-25T00:13:00.000Z",
    targetIdempotencyKey,
    assignmentKind: "strategy",
    strategyId,
    strategyVersion
  };
}
