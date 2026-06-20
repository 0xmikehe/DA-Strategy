import { describe, expect, it } from "vitest";
import type { ShadowMarketDataCollectionResult } from "@/signal/facts/collect-shadow-market-data";
import { runMarketDataCollectionJob } from "@/server/jobs/run-market-data-collection-job";

type RecordedJobRun = {
  id: string;
  data: Record<string, unknown>;
  updates: Array<Record<string, unknown>>;
};

function createFakeJobRunStore() {
  const runs: RecordedJobRun[] = [];

  const db = {
    jobRun: {
      async create({ data }: { data: Record<string, unknown> }) {
        const run: RecordedJobRun = { id: `job_${runs.length + 1}`, data, updates: [] };
        runs.push(run);
        return { id: run.id };
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const run = runs.find((candidate) => candidate.id === where.id);
        run?.updates.push(data);
        return { id: where.id };
      }
    }
  } as unknown as Parameters<typeof runMarketDataCollectionJob>[0]["db"];

  return { db, runs };
}

const succeededResult: ShadowMarketDataCollectionResult = {
  status: "succeeded",
  fetched: 4,
  stored: 4,
  failed: []
};

describe("runMarketDataCollectionJob", () => {
  it("records a running then succeeded job_run on success", async () => {
    const { db, runs } = createFakeJobRunStore();

    const result = await runMarketDataCollectionJob({
      db,
      targetKey: "BTCUSDT:1h",
      collect: async () => succeededResult
    });

    expect(result).toEqual(succeededResult);
    expect(runs).toHaveLength(1);
    expect(runs[0].data).toMatchObject({
      jobType: "signal_fact_collect",
      targetKey: "BTCUSDT:1h",
      status: "running",
      attempts: 1
    });
    expect(runs[0].updates).toHaveLength(1);
    expect(runs[0].updates[0]).toMatchObject({ status: "succeeded", errorMessage: null });
  });

  it("marks the job_run failed and summarizes partial failures", async () => {
    const { db, runs } = createFakeJobRunStore();

    await runMarketDataCollectionJob({
      db,
      collect: async () => ({
        status: "failed",
        fetched: 3,
        stored: 3,
        failed: [{ fact_type: "open_interest_hist", symbol: "BTCUSDT", message: "network blocked" }]
      })
    });

    expect(runs[0].updates[0]).toMatchObject({ status: "failed" });
    expect(runs[0].updates[0].errorMessage).toContain("open_interest_hist@BTCUSDT: network blocked");
  });

  it("marks the job_run failed and rethrows when collection throws", async () => {
    const { db, runs } = createFakeJobRunStore();

    await expect(
      runMarketDataCollectionJob({
        db,
        collect: async () => {
          throw new Error("boom");
        }
      })
    ).rejects.toThrow("boom");

    expect(runs[0].updates[0]).toMatchObject({ status: "failed", errorMessage: "boom" });
  });
});
