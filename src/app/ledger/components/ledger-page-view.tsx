import React from "react";
import { AppShell } from "@/app/_components/phase1/app-shell";
import { StatusBadge } from "@/app/_components/phase1/status-badge";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { BindingHealthPanel } from "./binding-health-panel";
import { CurrentPositionPanel } from "./current-position-panel";
import { ExceptionActionsPanel } from "./exception-actions-panel";
import { LedgerFlowTable } from "./ledger-flow-table";
import { PendingAttributionQueue } from "./pending-attribution-queue";
import { PortfolioOverview } from "./portfolio-overview";
import { ReconciliationPanel } from "./reconciliation-panel";
import { ScopeSelector } from "./scope-selector";
import { SyncFreshnessBar } from "./sync-freshness-bar";

export function LedgerPageView({ model }: { model: LedgerPageModel }) {
  const pendingCount = model.selectedScope.kind === "all"
    ? model.portfolioSummary.pendingAttributionCount
    : model.pendingAttribution.items.length;

  return (
    <AppShell
      active="ledger"
      badges={
        <>
          <StatusBadge tone={model.freshness.state === "ok" ? "good" : model.freshness.state === "empty" ? "warn" : "risk"}>
            {model.freshness.label}
          </StatusBadge>
          <StatusBadge tone={pendingCount > 0 ? "warn" : "good"}>
            pending {pendingCount}
          </StatusBadge>
        </>
      }
      context={`facts ${model.sourceSummary.totalFacts}`}
      title="账本工作台"
    >
      <main className="page-frame">
        <header className="page-head">
          <div>
            <p className="page-kicker">P2 / Ledger Workbench</p>
            <h1 className="page-title">账本工作台</h1>
            <p className="page-summary">
              全部账户只展示组合摘要和账户入口；进入具体账户后查看持仓、历史流水、对账差异和异常兜底。
            </p>
          </div>
          <div className="action-row">
            <StatusBadge tone="frozen">append-only</StatusBadge>
            <StatusBadge tone="warn">no balance edit</StatusBadge>
          </div>
        </header>

        <section className="stack">
          <SyncFreshnessBar model={model} />
          <ScopeSelector model={model} />
          {model.selectedScope.kind === "all" ? (
            <PortfolioOverview model={model} />
          ) : (
            <div className="stack">
              <CurrentPositionPanel currentPositions={model.currentPositions} />
              <div className="grid-ledger">
                <div className="stack">
                  <ReconciliationPanel reconciliation={model.reconciliation} />
                  <PendingAttributionQueue pendingAttribution={model.pendingAttribution} />
                  <LedgerFlowTable flows={model.flows} />
                </div>
                <div className="stack">
                  <BindingHealthPanel bindingHealth={model.bindingHealth} />
                  <ExceptionActionsPanel options={model.externalTradeFormOptions} />
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
