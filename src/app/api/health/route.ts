import { NextResponse } from "next/server";
import { getServerEnv } from "@/server/config/env";
import { getHealthStatus } from "@/server/health";

export function GET() {
  getServerEnv();

  return NextResponse.json(getHealthStatus());
}
