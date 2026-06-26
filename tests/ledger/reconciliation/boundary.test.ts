import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const forbiddenSourceWritePattern =
  /\.(exchangeTradeFill|exchangeOrder|capitalFlowEvent|externalTrade|attributionRecord|ledgerReversal|accountBalanceSnapshot|syncCursor)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;

describe("replay and reconciliation boundaries", () => {
  it("does not write source fact tables or sync cursors", async () => {
    const violations: string[] = [];

    for (const filePath of await listTypeScriptFiles(path.join(process.cwd(), "src/ledger"))) {
      const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join("/");
      if (!/^src\/ledger\/(replay|reconciliation)\//.test(relativePath)) {
        continue;
      }

      const source = await readFile(filePath, "utf8");
      for (const match of source.matchAll(forbiddenSourceWritePattern)) {
        violations.push(`${relativePath}: ${match[0]}`);
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
