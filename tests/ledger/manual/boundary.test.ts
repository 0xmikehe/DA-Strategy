import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const writerServices = [
  "src/ledger/manual/external-trade-service.ts",
  "src/ledger/manual/attribution-service.ts",
  "src/ledger/manual/reversal-service.ts"
];

const forbiddenWritePattern =
  /\.(exchangeTradeFill|exchangeOrder|capitalFlowEvent|externalTrade|attributionRecord|ledgerReversal|accountBalanceSnapshot|syncCursor)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;
const forbiddenBalanceAdjustmentPattern = /manual_balance_adjustment|balance_adjustment|submitManualBalance/i;

describe("manual ledger write boundary", () => {
  it("routes manual source fact writes through appendLedgerFacts", async () => {
    for (const relativePath of writerServices) {
      const source = await readFile(path.join(process.cwd(), relativePath), "utf8");
      expect(source).toContain("appendLedgerFacts");
    }
  });

  it("does not write source fact tables directly from manual services", async () => {
    const violations: string[] = [];

    for (const filePath of await listTypeScriptFiles(path.join(process.cwd(), "src/ledger/manual"))) {
      const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join("/");
      const source = await readFile(filePath, "utf8");

      for (const match of source.matchAll(forbiddenWritePattern)) {
        violations.push(`${relativePath}: ${match[0]}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("does not expose a manual balance adjustment command", async () => {
    const violations: string[] = [];

    for (const filePath of await listTypeScriptFiles(path.join(process.cwd(), "src/ledger/manual"))) {
      const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join("/");
      const source = await readFile(filePath, "utf8");

      if (forbiddenBalanceAdjustmentPattern.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listTypeScriptFiles(entryPath);
      }

      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        return [entryPath];
      }

      return [];
    })
  );

  return files.flat();
}
