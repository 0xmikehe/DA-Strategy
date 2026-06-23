import type { AssetPoolItem, StrategyVersionRef, SyncSymbolSet } from "@/contracts/phase1";
import { assetPoolItemSchema, syncSymbolSetSchema } from "@/contracts/phase1.schemas";

const DEFAULT_ASSET_ROLES = [
  { asset: "USDT", role: "stable" },
  { asset: "BTC", role: "core" },
  { asset: "ETH", role: "core" },
  { asset: "SOL", role: "satellite" },
  { asset: "BNB", role: "fee_asset" }
] as const;

export function buildDefaultAssetPool(strategyVersion: StrategyVersionRef): AssetPoolItem[] {
  return DEFAULT_ASSET_ROLES.map((item) =>
    assetPoolItemSchema.parse({
      strategy_id: strategyVersion.strategy_id,
      strategy_version: strategyVersion.strategy_version,
      asset: item.asset,
      role: item.role,
      status: "active",
      effective_from: strategyVersion.effective_from
    })
  );
}

export function buildDefaultSyncSymbolSet(assetPool: readonly AssetPoolItem[]): SyncSymbolSet {
  const activeTradeAssets = assetPool.filter((item) => item.status === "active" && item.asset !== "USDT");
  const [firstAsset] = activeTradeAssets;

  if (!firstAsset) {
    throw new Error("P1 sync symbol set requires at least one active non-stable asset");
  }

  return syncSymbolSetSchema.parse({
    strategy_id: firstAsset.strategy_id,
    strategy_version: firstAsset.strategy_version,
    spot_symbols: activeTradeAssets.map((item) => `${item.asset}USDT`),
    derived_from_assets: activeTradeAssets.map((item) => item.asset),
    effective_from: firstAsset.effective_from
  });
}
