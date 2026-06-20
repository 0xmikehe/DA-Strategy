export const signalFactsModule = {
  layer: "signal",
  module: "facts",
  phase: "phase1-p0",
  responsibility: "Binance-sourced market facts and collector metadata"
} as const;

export {
  normalizeMarketDerivedFact,
  queryMarketDerivedFacts,
  upsertMarketDerivedFacts
} from "./market-derived-facts";
