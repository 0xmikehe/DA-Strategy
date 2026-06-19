import { NextResponse } from "next/server";
import { getServerEnv } from "@/server/config/env";
import { getP1MarketReadModel } from "@/server/read-model/p1-walking-skeleton";

export function GET() {
  getServerEnv();

  return NextResponse.json(getP1MarketReadModel());
}
