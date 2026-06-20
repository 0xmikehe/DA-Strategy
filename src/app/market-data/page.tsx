import React from "react";
import { MarketDataPageView } from "../_components/phase1/market-data-page-view";
import { getP15MarketDataReadModel } from "@/server/read-model/p15-market-data";

export const dynamic = "force-dynamic";

export default async function MarketDataPage() {
  const marketData = await getP15MarketDataReadModel();

  return <MarketDataPageView marketData={marketData} />;
}
