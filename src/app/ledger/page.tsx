import React from "react";
import { getLedgerPageModel } from "@/ledger/page-model/get-ledger-page-model";
import { LedgerPageView } from "./components/ledger-page-view";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const model = await getLedgerPageModel();

  return <LedgerPageView model={model} />;
}
