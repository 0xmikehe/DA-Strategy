import type { LedgerDataSourceMode } from "@/ledger/ingest";
import type { ReconciliationStatus } from "@/ledger/reconciliation/types";
import { compareDecimalStrings } from "@/ledger/reconciliation/decimal";

export function sourceModeLabel(sourceMode: LedgerDataSourceMode): string {
  switch (sourceMode) {
    case "fixture":
      return "fixture";
    case "mock":
      return "mock";
    case "cassette":
      return "cassette";
    case "remote_import":
      return "remote_import";
    case "live":
      return "live";
  }
}

export function signedDecimal(value: string): string {
  if (value.startsWith("-")) {
    return value;
  }

  if (compareDecimalStrings(value, "0") > 0) {
    return `+${value}`;
  }

  return value;
}

export function reconciliationStatusLabel(status: ReconciliationStatus): string {
  switch (status) {
    case "MATCHED":
      return "已对平";
    case "MISSING_EVENT":
      return "疑似漏事件";
    case "EXTERNAL_BALANCE_MISMATCH":
      return "外部余额差异";
    case "NEEDS_CLASSIFICATION":
      return "待分类";
  }
}

export function reconciliationTone(status: ReconciliationStatus): "good" | "warn" | "risk" {
  switch (status) {
    case "MATCHED":
      return "good";
    case "NEEDS_CLASSIFICATION":
      return "warn";
    case "MISSING_EVENT":
    case "EXTERNAL_BALANCE_MISMATCH":
      return "risk";
  }
}

export function freshnessLabel(state: "ok" | "stale" | "fail" | "load" | "empty"): string {
  switch (state) {
    case "ok":
      return "已同步 ok";
    case "stale":
      return "数据陈旧 stale";
    case "fail":
      return "同步失败 fail";
    case "load":
      return "处理中 load";
    case "empty":
      return "暂无账本数据 empty";
  }
}
