import React from "react";
import { StatusBadge } from "@/app/_components/phase1/status-badge";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { SourceModeBadge } from "./source-mode-badge";

type SyncFreshnessBarProps = {
  model: LedgerPageModel;
};

export function SyncFreshnessBar({ model }: SyncFreshnessBarProps) {
  const tone = model.freshness.state === "ok" ? "good" : model.freshness.state === "empty" ? "warn" : "risk";

  return (
    <section className="panel">
      <div className="panel-head">
        <span>同步与新鲜度</span>
        <StatusBadge tone={tone}>{model.freshness.label}</StatusBadge>
      </div>
      <div className="panel-body">
        <div className="ledger-status-grid">
          <div className="snapshot-item">
            <span>latest_success</span>
            <strong>{model.freshness.latestAt ?? "暂无"}</strong>
            <small>{model.freshness.safeReason ?? "mock / cassette / remote_import 数据会明确显示来源，不伪装成 live。"}</small>
          </div>
          <div className="snapshot-item">
            <span>capabilities</span>
            <strong>{model.capabilities.liveRuntime ? "live runtime enabled" : "offline page loop"}</strong>
            <small>手工同步在当前闭环禁用；对账、归因、冲正、外部交易录入可用。</small>
          </div>
          <div className="snapshot-item">
            <span>source_modes</span>
            <div className="badge-row align-left">
              {model.sourceSummary.modes.length === 0 ? (
                <StatusBadge tone="warn">empty</StatusBadge>
              ) : (
                model.sourceSummary.modes.map((row) => <SourceModeBadge key={row.sourceMode} sourceMode={row.sourceMode} />)
              )}
            </div>
          </div>
          <div className="snapshot-item">
            <span>fact_count</span>
            <strong>{model.sourceSummary.totalFacts}</strong>
            <small>{model.sourceSummary.modes.map((row) => `${row.sourceMode}:${row.factCount}`).join(" / ") || "暂无事实"}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
