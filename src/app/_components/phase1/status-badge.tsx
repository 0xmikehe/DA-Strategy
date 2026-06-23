import React from "react";
import type { ReactNode } from "react";

type StatusBadgeTone = "default" | "good" | "warn" | "risk" | "frozen";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

export function StatusBadge({ children, tone = "default" }: StatusBadgeProps) {
  const className = tone === "default" ? "status-badge" : `status-badge ${tone}`;

  return <span className={className}>{children}</span>;
}
