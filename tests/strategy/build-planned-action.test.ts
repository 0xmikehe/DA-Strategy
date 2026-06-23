import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { plannedActionSchema, syncSymbolSetSchema } from "@/contracts/phase1.schemas";
import { buildDefaultAssetPool, buildDefaultSyncSymbolSet } from "@/strategy/asset-pool/default-asset-pool";
import { buildPlannedAction } from "@/strategy/actions/build-planned-action";
import {
  expectedActiveSignalSet,
  expectedLedgerPositionView,
  expectedPlannedAction,
  p1AssetPoolItems,
  p1StrategyVersion
} from "../fixtures/phase1/walking-skeleton";

describe("buildPlannedAction", () => {
  it("builds the default asset pool and sync symbol set from strategy-owned assets", () => {
    expect(buildDefaultAssetPool(p1StrategyVersion)).toEqual(p1AssetPoolItems);
    expect(syncSymbolSetSchema.parse(buildDefaultSyncSymbolSet(p1AssetPoolItems))).toEqual({
      strategy_id: "core_allocation_lt",
      strategy_version: "v1",
      spot_symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"],
      derived_from_assets: ["BTC", "ETH", "SOL", "BNB"],
      effective_from: "2026-06-01T00:00:00.000Z"
    });
  });

  it("generates a traceable planned action from active signals and ledger position", () => {
    const action = buildPlannedAction({
      active_signal_set: expectedActiveSignalSet,
      ledger_position: expectedLedgerPositionView
    });

    expect(plannedActionSchema.parse(action)).toEqual(expectedPlannedAction);
  });

  it("does not import signal facts or raw market fact modules", async () => {
    const source = await readFile("src/strategy/actions/build-planned-action.ts", "utf8");

    expect(source).not.toContain("@/signal/facts");
    expect(source).not.toContain("src/signal/facts");
  });
});
