import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { checkDatabaseConnection } from "@/server/db/smoke";

describe("database smoke", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to Postgres and verifies P0 baseline tables exist", async () => {
    const result = await checkDatabaseConnection();

    expect(result).toMatchObject({
      status: "ok",
      database: "postgresql"
    });
    expect(result.tables.job_run).toEqual(expect.any(Number));
    expect(result.tables.sync_cursor).toEqual(expect.any(Number));
    expect(result.tables.decision_snapshot).toEqual(expect.any(Number));
  });
});
