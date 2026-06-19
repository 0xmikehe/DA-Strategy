import { describe, expect, it } from "vitest";
import { getHealthStatus } from "@/server/health";

describe("getHealthStatus", () => {
  it("returns the P0 service health payload", () => {
    const status = getHealthStatus({
      now: new Date("2026-06-19T00:00:00.000Z")
    });

    expect(status).toEqual({
      status: "ok",
      service: "digital-asset-ops",
      phase: "phase1-p0",
      timestamp: "2026-06-19T00:00:00.000Z"
    });
  });
});
