import { describe, expect, it } from "vitest";
import { signalSnapshotContentSchema, signalSnapshotRefSchema } from "@/contracts/phase1.schemas";
import { buildSignalSnapshot } from "@/signal/snapshot/build-signal-snapshot";
import {
  expectedActiveSignalSet,
  p1FixtureIds,
  p1FundingRates,
  p1MarketCandles
} from "../fixtures/phase1/walking-skeleton";

describe("buildSignalSnapshot", () => {
  it("builds enabled signals, stable input refs, and a snapshot ref from fixture facts", () => {
    const snapshot = buildSignalSnapshot({
      snapshot_id: p1FixtureIds.snapshotId,
      evaluated_at: p1FixtureIds.evaluatedAt,
      schema_version: "phase1.snapshot.v1",
      market_candles: p1MarketCandles,
      funding_rates: p1FundingRates
    });

    expect(signalSnapshotContentSchema.parse(snapshot.content)).toMatchObject({
      snapshot_id: p1FixtureIds.snapshotId,
      active_signal_set: expectedActiveSignalSet,
      data_health: "complete"
    });
    expect(signalSnapshotRefSchema.parse(snapshot.ref)).toMatchObject({
      snapshot_id: p1FixtureIds.snapshotId,
      schema_version: "phase1.snapshot.v1"
    });
    expect(snapshot.ref.content_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.content.input_refs).toHaveLength(p1MarketCandles.length + p1FundingRates.length);
  });
});
