import { pathToFileURL } from "node:url";
import { prisma } from "./prisma";

export type DatabaseSmokeResult = {
  status: "ok";
  database: "postgresql";
  tables: {
    job_run: number;
    sync_cursor: number;
    decision_snapshot: number;
  };
};

export async function checkDatabaseConnection(): Promise<DatabaseSmokeResult> {
  const [jobRunCount, syncCursorCount, decisionSnapshotCount] = await Promise.all([
    prisma.jobRun.count(),
    prisma.syncCursor.count(),
    prisma.decisionSnapshot.count()
  ]);

  return {
    status: "ok",
    database: "postgresql",
    tables: {
      job_run: jobRunCount,
      sync_cursor: syncCursorCount,
      decision_snapshot: decisionSnapshotCount
    }
  };
}

async function main() {
  try {
    console.log(JSON.stringify(await checkDatabaseConnection()));
  } finally {
    await prisma.$disconnect();
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
