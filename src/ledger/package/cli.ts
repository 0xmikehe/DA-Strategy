import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promotePackageToCassette } from "@/ledger/cassette/promote";
import { generateMockLedgerPackage } from "@/ledger/mock/generate-package";
import { mockLedgerScenarioIds, type MockLedgerScenarioId } from "@/ledger/mock/scenarios";
import { importLedgerPackage } from "./import-package";
import type { LedgerExportPackage } from "./types";

export type LedgerPackageCliIO = {
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

const defaultCliIO: LedgerPackageCliIO = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message)
};

export async function runLedgerPackageCli(args = process.argv.slice(2), io: LedgerPackageCliIO = defaultCliIO): Promise<void> {
  const [command, ...flags] = args;

  switch (command) {
    case "mock-package": {
      const scenario = requireMockScenario(requireFlag(flags, "--scenario"));
      const outPath = requireFlag(flags, "--out");
      await writeJson(outPath, generateMockLedgerPackage({ scenarioId: scenario }));
      io.stdout?.(outPath);
      return;
    }
    case "import-package": {
      const filePath = requireFlag(flags, "--file");
      const summary = await importLedgerPackage(filePath);
      io.stdout?.(JSON.stringify(summary, null, 2));
      return;
    }
    case "cassette-promote": {
      const filePath = requireFlag(flags, "--file");
      const cassetteId = requireFlag(flags, "--cassette-id");
      const outPath = requireFlag(flags, "--out");
      const ledgerPackage = JSON.parse(await readFile(filePath, "utf8")) as LedgerExportPackage;
      await writeJson(outPath, promotePackageToCassette(ledgerPackage, cassetteId));
      io.stdout?.(outPath);
      return;
    }
    default:
      throw new Error(`Unknown ledger package command: ${command ?? "<missing>"}`);
  }
}

function requireFlag(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  if (!value) {
    throw new Error(`Missing required flag ${flag}`);
  }

  return value;
}

function requireMockScenario(value: string): MockLedgerScenarioId {
  if (!mockLedgerScenarioIds.includes(value as MockLedgerScenarioId)) {
    throw new Error(`Unknown mock ledger scenario: ${value}`);
  }

  return value as MockLedgerScenarioId;
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isCliEntrypoint(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  runLedgerPackageCli().catch((error: unknown) => {
    defaultCliIO.stderr?.(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
