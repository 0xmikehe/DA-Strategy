import React from "react";
import { AppShell } from "@/app/_components/phase1/app-shell";
import { StatusBadge } from "@/app/_components/phase1/status-badge";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { BindingHealthPanel } from "./binding-health-panel";
import { ExternalTradeEntry } from "./external-trade-entry";
import { LedgerFlowTable } from "./ledger-flow-table";
import { PendingAttributionQueue } from "./pending-attribution-queue";
import { ReconciliationPanel } from "./reconciliation-panel";
import { SyncFreshnessBar } from "./sync-freshness-bar";

export function LedgerPageView({ model }: { model: LedgerPageModel }) {
  return (
    <AppShell
      active="ledger"
      badges={
        <>
          <StatusBadge tone={model.freshness.state === "ok" ? "good" : model.freshness.state === "empty" ? "warn" : "risk"}>
            {model.freshness.label}
          </StatusBadge>
          <StatusBadge tone={model.pendingAttribution.items.length > 0 ? "warn" : "good"}>
            pending {model.pendingAttribution.items.length}
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
              同步状态、对账差异和待归属队列优先展示。页面消费 mock / cassette / remote_import / live 事实来源，写操作只委派到账本服务。
            </p>
          </div>
          <div className="action-row">
            <StatusBadge tone="frozen">append-only</StatusBadge>
            <StatusBadge tone="warn">no balance edit</StatusBadge>
          </div>
        </header>

        <section className="stack">
          <SyncFreshnessBar model={model} />
          <div className="grid-ledger">
            <div className="stack">
              <ReconciliationPanel reconciliation={model.reconciliation} />
              <PendingAttributionQueue pendingAttribution={model.pendingAttribution} />
              <LedgerFlowTable flows={model.flows} />
            </div>
            <div className="stack">
              <ExternalTradeEntry options={model.externalTradeFormOptions} />
              <BindingHealthPanel bindingHealth={model.bindingHealth} />
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
