import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { requestLedgerSync } from "@/app/ledger/actions";

const forbiddenWritePattern =
  /\.(exchangeTradeFill|exchangeOrder|capitalFlowEvent|externalTrade|attributionRecord|ledgerReversal|accountBalanceSnapshot|syncCursor)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;

describe("ledger page action boundary", () => {
  it("keeps live sync unavailable in the offline page loop", async () => {
    await expect(requestLedgerSync()).resolves.toMatchObject({
      ok: false,
      status: "unavailable"
    });
  });

  it("delegates write actions to P2 services and does not write source facts directly", async () => {
    const source = await readFile("src/app/ledger/actions.ts", "utf8");

    expect(source).toContain("submitManualAttribution");
    expect(source).toContain("submitManualExternalTrade");
    expect(source).toContain("submitManualReversal");
    expect(source).toContain("runLedgerReconciliation");
    expect([...source.matchAll(forbiddenWritePattern)]).toEqual([]);
  });

  it("does not expose a manual balance adjustment action", async () => {
    const source = await readFile("src/app/ledger/actions.ts", "utf8");

    expect(source).not.toMatch(/manual_balance_adjustment|balance_adjustment|adjustBalance|submitLedgerBalance/i);
  });
});
