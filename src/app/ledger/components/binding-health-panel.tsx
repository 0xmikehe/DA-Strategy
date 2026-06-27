import React from "react";
import { StatusBadge } from "@/app/_components/phase1/status-badge";
import type { LedgerPageModel } from "@/ledger/page-model/types";

type BindingHealthPanelProps = {
  bindingHealth: LedgerPageModel["bindingHealth"];
};

export function BindingHealthPanel({ bindingHealth }: BindingHealthPanelProps) {
  const tone = bindingHealth.state === "OK" ? "good" : bindingHealth.state === "BLOCK" ? "risk" : "warn";

  return (
    <section className="panel">
      <div className="panel-head">
        <span>绑定与凭证健康</span>
        <StatusBadge tone={tone}>{bindingHealth.state}</StatusBadge>
      </div>
      <div className="panel-body">
        <div className="snapshot-grid">
          <div className="snapshot-item">
            <span>summary</span>
            <strong>{bindingHealth.label}</strong>
            <small>{bindingHealth.safeReason}</small>
          </div>
          <div className="snapshot-item">
            <span>last_checked</span>
            <strong>{bindingHealth.lastCheckedAt ?? "not available"}</strong>
            <small>页面只读展示健康摘要，不录入 API secret，也不显示密钥引用。</small>
          </div>
        </div>
      </div>
    </section>
  );
}
