import { describe, expect, it } from "vitest";
import { applyTrackedValuation, summarizeValuedPositions } from "@/ledger/page-model/valuation";
import type { LedgerPagePositionRow } from "@/ledger/page-model/types";

describe("ledger page tracked valuation", () => {
  it("values only tracked assets and leaves untracked assets unpriced", () => {
    const rows = applyTrackedValuation([
      position("BTC", "0.00999000"),
      position("USDT", "350.00000000"),
      position("SOL", "9.99000000")
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        asset: "BTC",
        valuationStatus: "priced",
        priceUsd: "65000.00",
        estimatedValueUsd: "649.35"
      }),
      expect.objectContaining({
        asset: "SOL",
        valuationStatus: "unpriced",
        priceUsd: undefined,
        estimatedValueUsd: undefined
      }),
      expect.objectContaining({
        asset: "USDT",
        valuationStatus: "stablecoin_peg",
        priceUsd: "1.00",
        estimatedValueUsd: "350.00"
      })
    ]);

    expect(summarizeValuedPositions(rows)).toEqual({
      estimatedValueUsd: "999.35",
      pricedAssetCount: 2,
      unpricedAssetCount: 1
    });
  });
});

function position(asset: string, quantity: string): LedgerPagePositionRow {
  return {
    scopeType: "account",
    scopeId: "acct_mock_core_spot",
    asset,
    quantity,
    signedQuantity: `+${quantity}`
  };
}
