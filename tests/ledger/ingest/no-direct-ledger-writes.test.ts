import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const allowedWriters = new Set(["src/ledger/ingest/append-ledger-facts.ts"]);

const forbiddenWritePattern =
  /\.(exchangeTradeFill|exchangeOrder|capitalFlowEvent|externalTrade|attributionRecord|ledgerReversal|accountBalanceSnapshot|syncCursor)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;

describe("ledger source fact write boundary", () => {
  it("keeps production ledger fact and cursor writes inside appendLedgerFacts", async () => {
    const violations: string[] = [];
    const srcRoot = path.join(process.cwd(), "src");

    for (const filePath of await listTypeScriptFiles(srcRoot)) {
      const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join("/");
      const source = await readFile(filePath, "utf8");

      for (const match of source.matchAll(forbiddenWritePattern)) {
        if (!allowedWriters.has(relativePath)) {
          violations.push(`${relativePath}: ${match[0]}`);
        }
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
