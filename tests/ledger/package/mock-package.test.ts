import { describe, expect, it } from "vitest";
import { canonicalJson } from "@/ledger/ingest";
import { verifyPackageHash } from "@/ledger/package/hash";
import { ledgerPackageSourceFactSections } from "@/ledger/package/types";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";

describe("mock ledger package generation", () => {
  it("generates byte-stable canonical package JSON and hash for the same scenario", () => {
    const first = generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" });
    const second = generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" });

    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(first.manifest.content_hash).toBe(second.manifest.content_hash);
    expect(verifyPackageHash(first)).toEqual(first);
  });

  it("marks every generated package as mock", () => {
    const ledgerPackage = generateMockLedgerPackage({ scenarioId: "empty_healthy_account" });

    expect(ledgerPackage.manifest.package_kind).toBe("mock");
    expect(ledgerPackage.manifest.source_env_id).toBe("mock-local");
    expect(ledgerPackage.manifest.redaction_level).toBe("none");
  });

  it("creates the deposit_buy_fee scenario with a deposit, buy fill, fee, and balance snapshot", () => {
    const ledgerPackage = generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" });

    expect(ledgerPackage.capital_flow_events).toHaveLength(1);
    expect(ledgerPackage.exchange_trade_fills.filter((row) => row.payload.side === "BUY")).toHaveLength(1);
    expect(ledgerPackage.exchange_trade_fills.filter((row) => row.payload.commission === "0.00001000")).toHaveLength(1);
    expect(ledgerPackage.account_balance_snapshots).toHaveLength(1);
  });

  it("adds mock origin metadata to generated source facts", () => {
    const ledgerPackage = generateMockLedgerPackage({ scenarioId: "deposit_buy_fee" });
    const sourceFacts = ledgerPackageSourceFactSections.flatMap((section) => ledgerPackage[section]);

    expect(sourceFacts.length).toBeGreaterThan(0);
    expect(sourceFacts.every((row) => row.origin?.kind === "mock_scenario")).toBe(true);
    expect(sourceFacts.every((row) => row.origin?.kind !== "mock_scenario" || row.origin.scenario_id === "deposit_buy_fee")).toBe(true);
  });
});
