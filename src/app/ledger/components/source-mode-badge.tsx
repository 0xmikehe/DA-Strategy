import React from "react";
import type { LedgerDataSourceMode } from "@/ledger/ingest";
import { StatusBadge } from "@/app/_components/phase1/status-badge";

type SourceModeBadgeProps = {
  sourceMode: LedgerDataSourceMode;
};

export function SourceModeBadge({ sourceMode }: SourceModeBadgeProps) {
  const tone = sourceMode === "live" ? "good" : sourceMode === "remote_import" ? "warn" : "frozen";

  return <StatusBadge tone={tone}>{sourceMode}</StatusBadge>;
}
