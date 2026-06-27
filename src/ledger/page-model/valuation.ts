import type { LedgerPagePositionRow } from "./types";

export type LedgerTrackedPrice = {
  asset: string;
  priceUsd: string;
  valuationStatus: "priced" | "stablecoin_peg";
};

export type LedgerValuationSummary = {
  estimatedValueUsd?: string;
  pricedAssetCount: number;
  unpricedAssetCount: number;
};

const QUANTITY_SCALE = 100000000n;
const CENT_SCALE = 100n;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export const defaultTrackedPrices: LedgerTrackedPrice[] = [
  { asset: "BTC", priceUsd: "65000.00", valuationStatus: "priced" },
  { asset: "ETH", priceUsd: "3500.00", valuationStatus: "priced" },
  { asset: "USDT", priceUsd: "1.00", valuationStatus: "stablecoin_peg" }
];

export function applyTrackedValuation(
  rows: LedgerPagePositionRow[],
  prices: LedgerTrackedPrice[] = defaultTrackedPrices
): LedgerPagePositionRow[] {
  const priceByAsset = new Map(prices.map((price) => [price.asset, price]));

  return rows
    .map((row) => {
      const trackedPrice = priceByAsset.get(row.asset);
      if (!trackedPrice) {
        return {
          ...row,
          valuationStatus: "unpriced" as const,
          priceUsd: undefined,
          estimatedValueUsd: undefined
        };
      }

      return {
        ...row,
        valuationStatus: trackedPrice.valuationStatus,
        priceUsd: trackedPrice.priceUsd,
        estimatedValueUsd: multiplyQuantityByUsd(row.quantity, trackedPrice.priceUsd)
      };
    })
    .sort((left, right) => left.scopeId.localeCompare(right.scopeId) || left.asset.localeCompare(right.asset));
}

export function summarizeValuedPositions(rows: LedgerPagePositionRow[]): LedgerValuationSummary {
  let totalCents = 0n;
  const pricedAssets = new Set<string>();
  const unpricedAssets = new Set<string>();

  for (const row of rows) {
    if (row.estimatedValueUsd) {
      totalCents += parseUsdCents(row.estimatedValueUsd);
      pricedAssets.add(row.asset);
    } else {
      unpricedAssets.add(row.asset);
    }
  }

  return {
    estimatedValueUsd: pricedAssets.size > 0 ? formatUsdCents(totalCents) : undefined,
    pricedAssetCount: pricedAssets.size,
    unpricedAssetCount: unpricedAssets.size
  };
}

function multiplyQuantityByUsd(quantity: string, priceUsd: string): string {
  const quantityScaled = parseQuantity(quantity);
  const priceCents = parseUsdCents(priceUsd);
  const product = quantityScaled * priceCents;
  const roundedCents = roundScaled(product, QUANTITY_SCALE);
  return formatUsdCents(roundedCents);
}

function parseQuantity(value: string): bigint {
  return parseFixed(value, QUANTITY_SCALE, 8, "LEDGER_VALUATION_QUANTITY_INVALID");
}

function parseUsdCents(value: string): bigint {
  return parseFixed(value, CENT_SCALE, 2, "LEDGER_VALUATION_USD_INVALID");
}

function parseFixed(value: string, scale: bigint, fractionDigits: number, errorCode: string): bigint {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new Error(errorCode);
  }

  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.replace(/^-/, "");
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const fraction = fractionPart.padEnd(fractionDigits, "0").slice(0, fractionDigits);
  return sign * (BigInt(integerPart) * scale + BigInt(fraction));
}

function roundScaled(value: bigint, scale: bigint): bigint {
  if (value < 0n) {
    return -roundScaled(-value, scale);
  }
  return (value + scale / 2n) / scale;
}

function formatUsdCents(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const dollars = absolute / CENT_SCALE;
  const cents = (absolute % CENT_SCALE).toString().padStart(2, "0");
  return `${sign}${dollars}.${cents}`;
}
