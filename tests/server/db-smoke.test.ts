import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { checkDatabaseConnection } from "@/server/db/smoke";

describe("database smoke", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to Postgres and verifies baseline and P2 ledger tables exist", async () => {
    const result = await checkDatabaseConnection();

    expect(result).toMatchObject({
      status: "ok",
      database: "postgresql"
    });
    expect(result.tables.job_run).toEqual(expect.any(Number));
    expect(result.tables.sync_cursor).toEqual(expect.any(Number));
    expect(result.tables.decision_snapshot).toEqual(expect.any(Number));
    expect(result.tables.strategy_version).toEqual(expect.any(Number));
    expect(result.tables.asset_pool_item).toEqual(expect.any(Number));
    expect(result.tables.market_candle_fact).toEqual(expect.any(Number));
    expect(result.tables.funding_rate_fact).toEqual(expect.any(Number));
    expect(result.tables.market_derived_fact).toEqual(expect.any(Number));
    expect(result.tables.exchange_account).toEqual(expect.any(Number));
    expect(result.tables.strategy_account_binding).toEqual(expect.any(Number));
    expect(result.tables.ledger_event).toEqual(expect.any(Number));
    expect(result.tables.exchange_trade_fill).toEqual(expect.any(Number));
    expect(result.tables.exchange_order).toEqual(expect.any(Number));
    expect(result.tables.capital_flow_event).toEqual(expect.any(Number));
    expect(result.tables.external_trade).toEqual(expect.any(Number));
    expect(result.tables.attribution_record).toEqual(expect.any(Number));
    expect(result.tables.ledger_reversal).toEqual(expect.any(Number));
    expect(result.tables.account_balance_snapshot).toEqual(expect.any(Number));
    expect(result.tables.planned_action).toEqual(expect.any(Number));
    expect(result.tables.review_draft).toEqual(expect.any(Number));
    expect(result.tables.ledger_ingest_batch).toEqual(expect.any(Number));
    expect(result.tables.ledger_fact_observation).toEqual(expect.any(Number));
  });
});
