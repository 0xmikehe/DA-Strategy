import { pathToFileURL } from "node:url";
import { getServerEnv } from "../config/env";
import { jobTypes } from "../jobs/types";

export type WorkerSmokeResult = {
  status: "ok";
  mode: "smoke";
  job_types: typeof jobTypes;
};

export async function runWorkerSmoke(): Promise<WorkerSmokeResult> {
  return {
    status: "ok",
    mode: "smoke",
    job_types: jobTypes
  };
}

async function main() {
  const args = process.argv.slice(2);
  getServerEnv();

  if (args.includes("--smoke")) {
    console.log(JSON.stringify(await runWorkerSmoke()));
    return;
  }

  console.log(
    JSON.stringify({
      status: "idle",
      mode: args.includes("--once") ? "once" : "daemon",
      job_types: jobTypes
    })
  );
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
