import React from "react";
import type { P1SnapshotSummary } from "@/server/read-model/p1-walking-skeleton";

type SnapshotSummaryProps = {
  summary: P1SnapshotSummary;
  contentHash: string;
};

export function SnapshotSummary({ summary, contentHash }: SnapshotSummaryProps) {
  return (
    <section className="panel" aria-labelledby="snapshot-summary-title">
      <div className="panel-head">
        <span id="snapshot-summary-title">快照摘要</span>
        <span className="faint">SignalSnapshotRef</span>
      </div>
      <div className="panel-body">
        <div className="snapshot-grid">
          <div className="snapshot-item">
            <span>snapshot_id</span>
            <strong>{summary.snapshot_id}</strong>
          </div>
          <div className="snapshot-item">
            <span>data_health</span>
            <strong>{summary.data_health}</strong>
          </div>
          <div className="snapshot-item">
            <span>signals</span>
            <strong>{summary.signal_count}</strong>
          </div>
          <div className="snapshot-item">
            <span>input_refs</span>
            <strong>{summary.input_count}</strong>
          </div>
          <div className="snapshot-item">
            <span>content_hash</span>
            <strong>{contentHash}</strong>
          </div>
          <div className="snapshot-item">
            <span>enabled</span>
            <strong>{summary.enabled_signal_ids.join(", ")}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
