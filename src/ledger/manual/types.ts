import type { LedgerIngestActor, LedgerIngestResult } from "@/ledger/ingest";
import type { PrismaClient } from "@prisma/client";

export type ManualWriteContext = {
  prismaClient: PrismaClient;
  actor: LedgerIngestActor;
  afterIngest?: (result: LedgerIngestResult) => Promise<unknown>;
};

export type ManualWriteSummary = {
  result: LedgerIngestResult;
  reconciliationTrigger?: {
    attempted: boolean;
    ok: boolean;
    errorMessage?: string;
  };
};
