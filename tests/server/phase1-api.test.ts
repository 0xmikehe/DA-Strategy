import { describe, expect, it } from "vitest";
import { GET as getLedger } from "@/app/api/phase1/ledger/route";
import { GET as getMarket } from "@/app/api/phase1/market/route";

describe("Phase 1 API routes", () => {
  it("returns the P1 market read model", async () => {
    const response = getMarket();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.snapshotRef.snapshot_id).toBe("snap_2026_06_19_0001");
    expect(payload.snapshotSummary.data_health).toBe("complete");
    expect(JSON.stringify(payload)).not.toContain("raw_payload");
  });

  it("returns the P1 ledger read model without secret-like fields", async () => {
    const response = getLedger();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.traceability).toMatchObject({
      snapshot_id: "snap_2026_06_19_0001",
      strategy_version: "v1"
    });
    expect(payload.plannedAction.status).toBe("draft");
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(JSON.stringify(payload)).not.toContain("key_ref");
    expect(JSON.stringify(payload)).not.toContain("raw_payload");
  });
});
