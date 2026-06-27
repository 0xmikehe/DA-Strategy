import React from "react";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { ExternalTradeEntry } from "./external-trade-entry";

type ExceptionActionsPanelProps = {
  options: LedgerPageModel["externalTradeFormOptions"];
};

export function ExceptionActionsPanel({ options }: ExceptionActionsPanelProps) {
  return (
    <details className="panel exception-panel">
      <summary className="panel-head">
        <span>异常处理</span>
        <span>外部交易 / 低频兜底</span>
      </summary>
      <div className="panel-body">
        <ExternalTradeEntry options={options} />
      </div>
    </details>
  );
}
