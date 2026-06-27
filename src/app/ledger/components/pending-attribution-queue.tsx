import React from "react";
import { StatusBadge } from "@/app/_components/phase1/status-badge";
import type { LedgerPageModel } from "@/ledger/page-model/types";
import { submitLedgerAttributionForm, submitLedgerReversalForm } from "../actions";
import { SourceModeBadge } from "./source-mode-badge";

type PendingAttributionQueueProps = {
  pendingAttribution: LedgerPageModel["pendingAttribution"];
};

export function PendingAttributionQueue({ pendingAttribution }: PendingAttributionQueueProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span>待归属交易队列</span>
        <StatusBadge tone={pendingAttribution.items.length > 0 ? "warn" : "good"}>{pendingAttribution.items.length} pending</StatusBadge>
      </div>
      <div className="panel-body tight">
        {pendingAttribution.items.length === 0 ? (
          <div className="empty-state">暂无待归属项。</div>
        ) : (
          <table className="data-table ledger-action-table">
            <thead>
              <tr>
                <th>target</th>
                <th>source</th>
                <th>account</th>
                <th className="right">qty</th>
                <th>actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingAttribution.items.map((item) => (
                <tr key={item.idempotencyKey}>
                  <td>
                    <span className="cell-main">{item.idempotencyKey}</span>
                    <small>{item.occurredAt}</small>
                  </td>
                  <td>
                    <SourceModeBadge sourceMode={item.sourceMode} />
                  </td>
                  <td>{item.accountId}</td>
                  <td className="right warning">
                    +{item.quantity} {item.asset}
                  </td>
                  <td>
                    <div className="action-row compact">
                      <AttributionButton item={item} assignmentKind="strategy" label="归属策略" />
                      <AttributionButton item={item} assignmentKind="external" label="标外部" />
                      <AttributionButton item={item} assignmentKind="unassigned" label="未分配" />
                      <form action={submitLedgerReversalForm} className="inline-form">
                        <input name="target_fact_kind" type="hidden" value={item.factKind} />
                        <input name="target_idempotency_key" type="hidden" value={item.idempotencyKey} />
                        <input name="reason_code" type="hidden" value="operator_correction" />
                        <input name="note" type="hidden" value="ledger page reversal" />
                        <button className="button" type="submit">冲正</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function AttributionButton({
  item,
  assignmentKind,
  label
}: {
  item: LedgerPageModel["pendingAttribution"]["items"][number];
  assignmentKind: "strategy" | "external" | "unassigned";
  label: string;
}) {
  return (
    <form action={submitLedgerAttributionForm} className="inline-form">
      <input name="target_fact_kind" type="hidden" value={item.factKind} />
      <input name="target_idempotency_key" type="hidden" value={item.idempotencyKey} />
      <input name="assignment_kind" type="hidden" value={assignmentKind} />
      <input name="strategy_id" type="hidden" value="core_allocation_lt" />
      <input name="strategy_version" type="hidden" value="v1" />
      <input name="reason_code" type="hidden" value={assignmentKind === "unassigned" ? "operator_unassigned_terminal" : "operator_classification"} />
      <button className={assignmentKind === "strategy" ? "button primary" : "button"} type="submit">{label}</button>
    </form>
  );
}
