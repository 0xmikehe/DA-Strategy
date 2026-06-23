import { createHash } from "node:crypto";
import {
  MarketDerivedFactType as PrismaMarketDerivedFactType,
  type Prisma,
  type PrismaClient
} from "@prisma/client";
import type { MarketDataFactType } from "@/contracts/p15-market-data";

type MarketDerivedFactStore = Pick<PrismaClient, "marketDerivedFact">;

export type NormalizeMarketDerivedFactInput = {
  source?: string;
  factType: MarketDataFactType;
  symbol: string;
  period: string;
  collectedAt: Date;
  rawPayload: Record<string, unknown>;
};

export type NormalizedMarketDerivedFact = {
  source: string;
  factType: MarketDataFactType;
  symbol: string;
  period: string;
  eventTime: Date;
  collectedAt: Date;
  sumOpenInterest?: string;
  sumOpenInterestValue?: string;
  cmcCirculatingSupply?: string;
  longShortRatio?: string;
  longRatio?: string;
  shortRatio?: string;
  contentHash: string;
  rawPayload: Record<string, unknown>;
};

export type QueryMarketDerivedFactsInput = {
  source?: string;
  symbol: string;
  period: string;
  factType?: MarketDataFactType;
  eventTimeFrom?: Date;
  eventTimeTo?: Date;
  knownAt?: Date;
  take?: number;
};

const defaultSource = "binance_usds_futures";

const prismaFactTypeByContract = {
  open_interest_hist: PrismaMarketDerivedFactType.open_interest_hist,
  global_long_short_account_ratio: PrismaMarketDerivedFactType.global_long_short_account_ratio,
  top_long_short_position_ratio: PrismaMarketDerivedFactType.top_long_short_position_ratio,
  top_long_short_account_ratio: PrismaMarketDerivedFactType.top_long_short_account_ratio
} satisfies Record<MarketDataFactType, PrismaMarketDerivedFactType>;

export function normalizeMarketDerivedFact(input: NormalizeMarketDerivedFactInput): NormalizedMarketDerivedFact {
  const source = input.source ?? defaultSource;
  const eventTime = timestampToDate(input.rawPayload.timestamp);
  const normalizedBase = {
    source,
    factType: input.factType,
    symbol: input.symbol,
    period: input.period,
    eventTime,
    collectedAt: input.collectedAt,
    rawPayload: input.rawPayload
  };

  if (input.factType === "open_interest_hist") {
    return withContentHash({
      ...normalizedBase,
      sumOpenInterest: readDecimal(input.rawPayload, "sumOpenInterest"),
      sumOpenInterestValue: readDecimal(input.rawPayload, "sumOpenInterestValue"),
      cmcCirculatingSupply: readDecimal(input.rawPayload, "CMCCirculatingSupply")
    });
  }

  return withContentHash({
    ...normalizedBase,
    longShortRatio: readDecimal(input.rawPayload, "longShortRatio"),
    longRatio: readFirstDecimal(input.rawPayload, ["longAccount", "longPosition", "longPositionRatio"]),
    shortRatio: readFirstDecimal(input.rawPayload, ["shortAccount", "shortPosition", "shortPositionRatio"])
  });
}

export async function upsertMarketDerivedFacts(
  db: MarketDerivedFactStore,
  facts: NormalizedMarketDerivedFact[]
) {
  const rows = [];

  for (const fact of facts) {
    rows.push(
      await db.marketDerivedFact.upsert({
        where: {
          source_factType_symbol_period_eventTime: {
            source: fact.source,
            factType: prismaFactTypeByContract[fact.factType],
            symbol: fact.symbol,
            period: fact.period,
            eventTime: fact.eventTime
          }
        },
        create: toPrismaCreateInput(fact),
        update: toPrismaUpdateInput(fact)
      })
    );
  }

  return rows;
}

export async function queryMarketDerivedFacts(
  db: MarketDerivedFactStore,
  input: QueryMarketDerivedFactsInput
) {
  return db.marketDerivedFact.findMany({
    where: {
      source: input.source ?? defaultSource,
      symbol: input.symbol,
      period: input.period,
      factType: input.factType ? prismaFactTypeByContract[input.factType] : undefined,
      eventTime:
        input.eventTimeFrom || input.eventTimeTo
          ? {
              gte: input.eventTimeFrom,
              lte: input.eventTimeTo
            }
          : undefined,
      collectedAt: input.knownAt
        ? {
            lte: input.knownAt
          }
        : undefined
    },
    orderBy: {
      eventTime: "desc"
    },
    take: input.take
  });
}

function toPrismaCreateInput(fact: NormalizedMarketDerivedFact) {
  return {
    source: fact.source,
    factType: prismaFactTypeByContract[fact.factType],
    symbol: fact.symbol,
    period: fact.period,
    eventTime: fact.eventTime,
    collectedAt: fact.collectedAt,
    ...nullableDecimalFields(fact),
    contentHash: fact.contentHash,
    rawPayload: fact.rawPayload as Prisma.InputJsonValue
  };
}

function toPrismaUpdateInput(fact: NormalizedMarketDerivedFact) {
  return {
    ...nullableDecimalFields(fact),
    contentHash: fact.contentHash,
    rawPayload: fact.rawPayload as Prisma.InputJsonValue
  };
}

function nullableDecimalFields(fact: NormalizedMarketDerivedFact) {
  return {
    sumOpenInterest: fact.sumOpenInterest ?? null,
    sumOpenInterestValue: fact.sumOpenInterestValue ?? null,
    cmcCirculatingSupply: fact.cmcCirculatingSupply ?? null,
    longShortRatio: fact.longShortRatio ?? null,
    longRatio: fact.longRatio ?? null,
    shortRatio: fact.shortRatio ?? null
  };
}

function withContentHash(
  fact: Omit<NormalizedMarketDerivedFact, "contentHash">
): NormalizedMarketDerivedFact {
  return {
    ...fact,
    contentHash: createHash("sha256")
      .update(
        stableJson({
          source: fact.source,
          factType: fact.factType,
          symbol: fact.symbol,
          period: fact.period,
          eventTime: fact.eventTime.toISOString(),
          rawPayload: fact.rawPayload
        })
      )
      .digest("hex")
  };
}

function timestampToDate(value: unknown) {
  const timestamp = typeof value === "string" ? Number(value) : value;

  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new Error("Binance futures data payload requires numeric timestamp");
  }

  return new Date(timestamp);
}

function readFirstDecimal(payload: Record<string, unknown>, fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    const value = readDecimal(payload, fieldName);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function readDecimal(payload: Record<string, unknown>, fieldName: string) {
  const value = payload[fieldName];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    return value;
  }

  throw new Error(`Invalid decimal field ${fieldName}`);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJson(nestedValue)])
    );
  }

  return value;
}
