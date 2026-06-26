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
    expect(result.tables.ledger_ingest_batch).toEqual(expect.any(Number));
    expect(result.tables.ledger_fact_observation).toEqual(expect.any(Number));
    expect(result.tables.exchange_trade_fill).toEqual(expect.any(Number));
    expect(result.tables.exchange_order).toEqual(expect.any(Number));
    expect(result.tables.capital_flow_event).toEqual(expect.any(Number));
    expect(result.tables.external_trade).toEqual(expect.any(Number));
    expect(result.tables.attribution_record).toEqual(expect.any(Number));
    expect(result.tables.ledger_reversal).toEqual(expect.any(Number));
    expect(result.tables.account_balance_snapshot).toEqual(expect.any(Number));
  });
});
