import { JobRunStatus, JobType, type PrismaClient } from "@prisma/client";
import type { ShadowMarketDataCollectionResult } from "@/signal/facts/collect-shadow-market-data";

type JobRunStore = Pick<PrismaClient, "jobRun">;

export type RunMarketDataCollectionJobDeps = {
  db: JobRunStore;
  collect: () => Promise<ShadowMarketDataCollectionResult>;
  targetKey?: string;
  now?: () => Date;
};

// 在影子采集前后记录一条 job_run，给"持续自建事实库"提供可复盘的运行历史：
// 何时跑、跑成没成、失败原因。collectShadowMarketData 保持纯函数，调度副作用收口在这里。
export async function runMarketDataCollectionJob(
  deps: RunMarketDataCollectionJobDeps
): Promise<ShadowMarketDataCollectionResult> {
  const now = deps.now ?? (() => new Date());
  const jobRun = await deps.db.jobRun.create({
    data: {
      jobType: JobType.signal_fact_collect,
      targetKey: deps.targetKey,
      status: JobRunStatus.running,
      attempts: 1,
      startedAt: now()
    }
  });

  try {
    const result = await deps.collect();

    await deps.db.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: result.status === "succeeded" ? JobRunStatus.succeeded : JobRunStatus.failed,
        finishedAt: now(),
        errorMessage: result.failed.length > 0 ? summarizeFailures(result.failed) : null
      }
    });

    return result;
  } catch (error) {
    await deps.db.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobRunStatus.failed,
        finishedAt: now(),
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });

    throw error;
  }
}

function summarizeFailures(failed: ShadowMarketDataCollectionResult["failed"]) {
  return failed.map((failure) => `${failure.fact_type}@${failure.symbol}: ${failure.message}`).join("; ");
}
