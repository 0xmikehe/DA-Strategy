import { describe, expect, it } from "vitest";
import { replayLedgerFacts } from "@/ledger/replay/replay-engine";
import type { LedgerReplayEvent } from "@/ledger/replay/types";

describe("ledger replay reversals", () => {
  it("cancels the target fact effect without deleting target evidence", () => {
    const events: LedgerReplayEvent[] = [
      {
        kind: "capital_flow",
        idempotencyKey: "flow_deposit_001",
        naturalKey: "flow:deposit:001",
        occurredAt: "2026-06-25T00:01:00.000Z",
        accountId: "acct_mock_core_spot",
        asset: "USDT",
        flowType: "deposit",
        amount: "1000.00000000"
      },
      {
        kind: "reversal",
        idempotencyKey: "reversal_flow_deposit_001",
        naturalKey: "reversal:flow:deposit:001",
        occurredAt: "2026-06-25T00:02:00.000Z",
        targetFactKind: "capital_flow_event",
        targetFactIdempotencyKey: "flow_deposit_001"
      }
    ];

    const replay = replayLedgerFacts(events);

    expect(replay.accountBalances).toEqual({});
    expect(replay.unassigned).toEqual({});
    expect(events).toHaveLength(2);
  });

  it("records a diagnostic when a reversal target is outside the replay scope", () => {
    const replay = replayLedgerFacts([
      {
        kind: "reversal",
        idempotencyKey: "reversal_missing",
        naturalKey: "reversal:missing",
        occurredAt: "2026-06-25T00:02:00.000Z",
        targetFactKind: "capital_flow_event",
        targetFactIdempotencyKey: "missing_target"
      }
    ]);

    expect(replay.diagnostics).toEqual([
      {
        code: "REVERSAL_TARGET_NOT_IN_REPLAY",
        message: "Reversal target missing_target was not present in replay scope",
        severity: "warn",
        factIdempotencyKey: "reversal_missing"
      }
    ]);
  });
});
