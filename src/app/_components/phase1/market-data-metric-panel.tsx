import React from "react";
import type { MarketDataMetricSummary } from "@/contracts/p15-market-data";
import { StatusBadge } from "./status-badge";

type MarketDataMetricPanelProps = {
  metric: MarketDataMetricSummary;
};

export function MarketDataMetricPanel({ metric }: MarketDataMetricPanelProps) {
  return (
    <section className="metric-card market-data-metric">
      <div className="metric-card-head">
        <div>
          <div className="metric-label">{metric.fact_type}</div>
          <h2 className="panel-title">{metric.label}</h2>
        </div>
        <StatusBadge tone={statusTone(metric.state)}>{metric.state}</StatusBadge>
      </div>

      <div className="metric-value accent">{metric.latest?.primary_value ?? "0"}</div>
      <div className="metric-note">
        {metric.latest?.value_label ?? "no value"} · lag {metric.latest_lag_minutes ?? 0}m
      </div>

      <div className="metric-mini-grid">
        <div>
          <span>24h points</span>
          <strong>{metric.points_24h}</strong>
        </div>
        <div>
          <span>7d points</span>
          <strong>{metric.points_7d}</strong>
        </div>
        <div>
          <span>missing</span>
          <strong className={metric.missing_points_24h > 0 ? "warning" : "positive"}>
            {metric.missing_points_24h}
          </strong>
        </div>
      </div>
    </section>
  );
}

function statusTone(state: MarketDataMetricSummary["state"]) {
  if (state === "shadow_collecting") {
    return "good";
  }

  if (state === "blocked" || state === "stale") {
    return "risk";
  }

  return "warn";
}
