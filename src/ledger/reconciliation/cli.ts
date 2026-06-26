import { pathToFileURL } from "node:url";
import { prisma } from "@/server/db/prisma";
import { runLedgerReconciliation } from "./run";

export type LedgerReconciliationCliIO = {
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

const defaultCliIO: LedgerReconciliationCliIO = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message)
};

export async function runLedgerReconciliationCli(args = process.argv.slice(2), io: LedgerReconciliationCliIO = defaultCliIO): Promise<void> {
  const now = new Date().toISOString();
  const runId = flagValue(args, "--run-id") ?? `recon_${now}`;
  const asOf = flagValue(args, "--as-of");
  const checkedAt = flagValue(args, "--checked-at") ?? asOf ?? now;
  const summary = await runLedgerReconciliation({
    prismaClient: prisma,
    runId,
    asOf,
    checkedAt
  });

  io.stdout?.(
    JSON.stringify(
      {
        runId: summary.runId,
        checkedAt: summary.checkedAt,
        written: summary.written,
        statuses: summary.results.map((result) => ({
          accountId: result.accountId,
          asset: result.asset,
          status: result.status
        }))
      },
      null,
      2
    )
  );
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function isCliEntrypoint(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  runLedgerReconciliationCli()
    .catch((error: unknown) => {
      defaultCliIO.stderr?.(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
