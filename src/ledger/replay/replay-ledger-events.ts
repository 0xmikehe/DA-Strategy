import type {
  CapitalFlowView,
  LedgerPositionView,
  LedgerTradeView
} from "@/contracts/phase1";
import {
  capitalFlowViewSchema,
  ledgerPositionViewSchema,
  ledgerTradeViewSchema
} from "@/contracts/phase1.schemas";

export type LedgerEventInput = {
  event_id: string;
  event_type: string;
  exchange_account_id: string;
  strategy_id?: string | null;
  strategy_version?: string | null;
  snapshot_id?: string | null;
  event_time: string;
  source: string;
  external_id?: string | null;
  idempotency_key: string;
  raw_payload: unknown;
};

export type ExchangeTradeFillInput = {
  trade_id: string;
  ledger_event_id: string;
  exchange_account_id: string;
  strategy_id: string;
  strategy_version: string;
  snapshot_id: string;
  symbol: string;
  side: "buy" | "sell";
  price: string;
  qty: string;
  commission_asset: string;
  commission_qty: string;
  time: string;
  external_trade_id: string;
  raw_payload: unknown;
};

export type CapitalFlowEventInput = {
  event_id: string;
  ledger_event_id: string;
  exchange_account_id: string;
  strategy_id?: string | null;
  flow_type: "deposit" | "withdrawal" | "transfer_in" | "transfer_out";
  asset: string;
  amount: string;
  event_time: string;
  source_account?: string | null;
  target_account?: string | null;
  external_id?: string | null;
  raw_payload: unknown;
};

export type ReplayLedgerEventsInput = {
  strategy_id: string;
  strategy_version: string;
  as_of: string;
  ledger_events: readonly LedgerEventInput[];
  trade_fills: readonly ExchangeTradeFillInput[];
  capital_flows: readonly CapitalFlowEventInput[];
};

export type LedgerReplay = {
  position_view: LedgerPositionView;
  trade_views: LedgerTradeView[];
  capital_flow_views: CapitalFlowView[];
};

type PositionAccumulator = {
  qty: bigint;
  costBasisQuote: bigint;
};

const DECIMAL_SCALE = 100000000n;
const ZERO_POSITION = "0.00000000";

export function replayLedgerEvents(input: ReplayLedgerEventsInput): LedgerReplay {
  const eventIds = new Set(input.ledger_events.map((event) => event.event_id));
  const positions = new Map<string, PositionAccumulator>();
  const tradeViews = input.trade_fills.map((fill) => {
    ensureEventExists(eventIds, fill.ledger_event_id);
    applyTradeFill(positions, fill);

    return ledgerTradeViewSchema.parse({
      trade_id: fill.trade_id,
      exchange_account_id: fill.exchange_account_id,
      strategy_id: fill.strategy_id,
      strategy_version: fill.strategy_version,
      snapshot_id: fill.snapshot_id,
      symbol: fill.symbol,
      side: fill.side,
      price: fill.price,
      qty: fill.qty,
      commission_asset: fill.commission_asset,
      commission_qty: fill.commission_qty,
      time: fill.time
    });
  });
  const capitalFlowViews = input.capital_flows.map((flow) => {
    ensureEventExists(eventIds, flow.ledger_event_id);
    addPositionQty(positions, flow.asset, parseDecimalString(flow.amount), 0n);

    return capitalFlowViewSchema.parse({
      event_id: flow.event_id,
      strategy_id: flow.strategy_id ?? undefined,
      flow_type: flow.flow_type,
      asset: flow.asset,
      amount: flow.amount,
      event_time: flow.event_time,
      source_account: flow.source_account ?? undefined,
      target_account: flow.target_account ?? undefined
    });
  });

  const positionView = ledgerPositionViewSchema.parse({
    strategy_id: input.strategy_id,
    strategy_version: input.strategy_version,
    as_of: input.as_of,
    assets: [...positions.entries()]
      .filter(([, position]) => position.qty !== 0n || position.costBasisQuote !== 0n)
      .sort(([leftAsset], [rightAsset]) => leftAsset.localeCompare(rightAsset))
      .map(([asset, position]) => ({
        asset,
        free_qty: formatDecimalString(position.qty),
        locked_qty: ZERO_POSITION,
        total_qty: formatDecimalString(position.qty),
        cost_basis_quote: formatDecimalString(position.costBasisQuote)
      }))
  });

  return {
    position_view: positionView,
    trade_views: tradeViews,
    capital_flow_views: capitalFlowViews
  };
}

function ensureEventExists(eventIds: Set<string>, ledgerEventId: string) {
  if (!eventIds.has(ledgerEventId)) {
    throw new Error(`Missing ledger event for ${ledgerEventId}`);
  }
}

function applyTradeFill(positions: Map<string, PositionAccumulator>, fill: ExchangeTradeFillInput) {
  const { baseAsset, quoteAsset } = splitSpotSymbol(fill.symbol);
  const qty = parseDecimalString(fill.qty);
  const notional = multiplyDecimalStrings(fill.price, fill.qty);
  const quoteCommission = fill.commission_asset === quoteAsset ? parseDecimalString(fill.commission_qty) : 0n;
  const baseCommission = fill.commission_asset === baseAsset ? parseDecimalString(fill.commission_qty) : 0n;
  const signedQty = fill.side === "buy" ? qty - baseCommission : -qty - baseCommission;
  const signedQuote = fill.side === "buy" ? -(notional + quoteCommission) : notional - quoteCommission;
  const baseCostBasis = fill.side === "buy" ? notional + quoteCommission : -notional;

  addPositionQty(positions, baseAsset, signedQty, baseCostBasis);
  addPositionQty(positions, quoteAsset, signedQuote, 0n);

  if (fill.commission_asset !== baseAsset && fill.commission_asset !== quoteAsset) {
    addPositionQty(positions, fill.commission_asset, -parseDecimalString(fill.commission_qty), 0n);
  }
}

function splitSpotSymbol(symbol: string): { baseAsset: string; quoteAsset: string } {
  if (!symbol.endsWith("USDT")) {
    throw new Error(`Unsupported P1 fixture symbol ${symbol}`);
  }

  return {
    baseAsset: symbol.slice(0, -"USDT".length),
    quoteAsset: "USDT"
  };
}

function addPositionQty(
  positions: Map<string, PositionAccumulator>,
  asset: string,
  qtyDelta: bigint,
  costBasisQuoteDelta: bigint
) {
  const current = positions.get(asset) ?? { qty: 0n, costBasisQuote: 0n };

  positions.set(asset, {
    qty: current.qty + qtyDelta,
    costBasisQuote: current.costBasisQuote + costBasisQuoteDelta
  });
}

function multiplyDecimalStrings(left: string, right: string): bigint {
  return (parseDecimalString(left) * parseDecimalString(right)) / DECIMAL_SCALE;
}

function parseDecimalString(value: string): bigint {
  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.replace(/^-/, "");
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const paddedFraction = fractionPart.padEnd(8, "0").slice(0, 8);

  return sign * (BigInt(integerPart) * DECIMAL_SCALE + BigInt(paddedFraction));
}

function formatDecimalString(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const integerPart = absolute / DECIMAL_SCALE;
  const fractionPart = (absolute % DECIMAL_SCALE).toString().padStart(8, "0");

  return `${sign}${integerPart}.${fractionPart}`;
}
