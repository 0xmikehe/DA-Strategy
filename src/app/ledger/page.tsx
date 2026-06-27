import React from "react";
import { getLedgerPageModel } from "@/ledger/page-model/get-ledger-page-model";
import { LedgerPageView } from "./components/ledger-page-view";

export const dynamic = "force-dynamic";

type LedgerPageProps = {
  searchParams?: Promise<{
    account?: string | string[];
  }>;
};

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  const params = await searchParams;
  const account = Array.isArray(params?.account) ? params.account[0] : params?.account;
  const model = await getLedgerPageModel({ selectedScopeId: account });

  return <LedgerPageView model={model} />;
}
