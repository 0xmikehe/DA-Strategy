import React from "react";
import type { LedgerPageModel } from "@/ledger/page-model/types";

type ScopeSelectorProps = {
  model: LedgerPageModel;
};

export function ScopeSelector({ model }: ScopeSelectorProps) {
  return (
    <nav aria-label="账本账户范围" className="scope-selector">
      {model.portfolioSummary.scopeOptions.map((option) => {
        const active = option.scopeId === model.selectedScope.scopeId;
        const href = option.kind === "all" ? "/ledger" : `/ledger?account=${encodeURIComponent(option.scopeId)}`;

        return (
          <a className={`scope-tab${active ? " is-active" : ""}`} href={href} key={option.scopeId}>
            <span>{option.label}</span>
            <small>
              {option.kind === "all"
                ? `${option.assetCount} assets`
                : `${option.role ?? "account"} / ${option.assetCount} assets`}
            </small>
          </a>
        );
      })}
    </nav>
  );
}
