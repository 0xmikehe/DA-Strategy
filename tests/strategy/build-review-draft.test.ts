import { describe, expect, it } from "vitest";
import { reviewDraftSchema } from "@/contracts/phase1.schemas";
import { buildReviewDraft } from "@/strategy/review/build-review-draft";
import {
  expectedLedgerPositionView,
  expectedPlannedAction,
  expectedReviewDraft,
  p1FixtureIds
} from "../fixtures/phase1/walking-skeleton";

const snapshotRef = {
  snapshot_id: p1FixtureIds.snapshotId,
  created_at: p1FixtureIds.evaluatedAt,
  schema_version: "phase1.snapshot.v1",
  content_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
};

describe("buildReviewDraft", () => {
  it("builds a deterministic draft that references snapshot refs and strategy version", () => {
    const draft = buildReviewDraft({
      period_start: "2026-06-19T00:00:00.000Z",
      period_end: "2026-06-20T00:00:00.000Z",
      snapshot_refs: [snapshotRef],
      planned_action: expectedPlannedAction,
      ledger_position: expectedLedgerPositionView,
      trade_views: [
        {
          trade_id: "trade_2026_06_19_0001",
          exchange_account_id: p1FixtureIds.exchangeAccountId,
          strategy_id: p1FixtureIds.strategyId,
          strategy_version: p1FixtureIds.strategyVersion,
          snapshot_id: p1FixtureIds.snapshotId,
          symbol: "BTCUSDT",
          side: "buy",
          price: "65000.00000000",
          qty: "0.10000000",
          commission_asset: "USDT",
          commission_qty: "6.50000000",
          time: "2026-06-19T00:05:00.000Z"
        }
      ]
    });

    expect(reviewDraftSchema.parse(draft)).toEqual({
      ...expectedReviewDraft,
      snapshot_refs: [snapshotRef]
    });
  });
});
