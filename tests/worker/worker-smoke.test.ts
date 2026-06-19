import { describe, expect, it } from "vitest";
import { jobTypes } from "@/server/jobs/types";
import { runWorkerSmoke } from "@/server/worker";

describe("worker smoke", () => {
  it("reports the P0 worker job types without contacting external services", async () => {
    const result = await runWorkerSmoke();

    expect(result).toEqual({
      status: "ok",
      mode: "smoke",
      job_types: jobTypes
    });
  });
});
