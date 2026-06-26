import type { LedgerFactKind, LedgerIngestCommand } from "@/ledger/ingest";

export function fixtureTradeCommand(overrides: Partial<LedgerIngestCommand> = {}): LedgerIngestCommand {
  const command: LedgerIngestCommand = {
    batch: {
      idempotency_key: "batch_fixture_trade_001",
      source_mode: "fixture",
      default_origin: { kind: "fixture", fixture_id: "fixture_p2_0" },
      actor: { kind: "system", name: "fixture-seed" },
      trigger: { kind: "fixture_seed", fixture_id: "fixture_p2_0" },
      requested_at: "2026-06-25T00:00:00.000Z"
    },
    facts: [
      {
        kind: "exchange_trade_fill",
        idempotency_key: "trade_acct_1_btcusdt_100",
        natural_key: "acct_1:BTCUSDT:100",
        occurred_at: "2026-06-25T00:00:00.000Z",
        payload: {
          exchange_account_id: "acct_1",
          strategy_id: "core_allocation_lt",
          strategy_version: "v1",
          snapshot_id: "snap_001",
          asset: "BTC",
          base_asset: "BTC",
          quote_asset: "USDT",
          symbol: "BTCUSDT",
          trade_id: "100",
          order_id: "500",
          price: "65000.00",
          qty: "0.01000000",
          quote_qty: "650.00",
          commission: "0.00001000",
          commission_asset: "BTC"
        }
      }
    ]
  };

  return mergeCommand(command, overrides);
}

export function remoteImportCommand(): LedgerIngestCommand {
  return mergeCommand(fixtureTradeCommand(), {
    batch: {
      idempotency_key: "batch_remote_trade_001",
      source_mode: "remote_import",
      default_origin: { kind: "remote_export", export_run_id: "lexp_001", original_source_mode: "live" },
      actor: { kind: "import_tool", name: "ledger-import-package" },
      trigger: { kind: "remote_import", import_run_id: "imp_001" },
      requested_at: "2026-06-25T00:00:00.000Z",
      package_metadata: {
        schema_version: "ledger.export.v1",
        package_id: "pkg_001",
        produced_at: "2026-06-25T00:00:00.000Z",
        content_hash: "sha256:pkg",
        source_env_id: "remote-prod-1",
        redaction_level: "default"
      },
      import_metadata: {
        schema_version: "ledger.export.v1",
        export_run_id: "lexp_001",
        source_env_id: "remote-prod-1",
        exported_at: "2026-06-25T00:00:00.000Z",
        content_hash: "sha256:pkg",
        redaction_level: "default"
      }
    }
  });
}

export function liveTradeCommand(): LedgerIngestCommand {
  return mergeCommand(fixtureTradeCommand(), {
    batch: {
      idempotency_key: "batch_live_trade_001",
      source_mode: "live",
      default_origin: { kind: "binance_user_data", endpoint: "GET /api/v3/myTrades" },
      actor: { kind: "system", name: "ledger-worker" },
      trigger: { kind: "scheduled_sync", job_run_id: "job_live_001" },
      requested_at: "2026-06-25T00:00:00.000Z",
      sync_metadata: {
        job_run_id: "job_live_001",
        exchange: "BINANCE",
        account_scope: "acct_1",
        endpoint_group: "spot_my_trades"
      }
    }
  });
}

export function liveEmptyCursorCommand(): LedgerIngestCommand {
  return {
    batch: {
      idempotency_key: "batch_live_empty_cursor_001",
      source_mode: "live",
      default_origin: { kind: "binance_user_data", endpoint: "GET /api/v3/myTrades" },
      actor: { kind: "system", name: "ledger-worker" },
      trigger: { kind: "scheduled_sync", job_run_id: "job_live_empty_001" },
      requested_at: "2026-06-25T00:00:00.000Z",
      sync_metadata: {
        job_run_id: "job_live_empty_001",
        exchange: "BINANCE",
        account_scope: "acct_1",
        endpoint_group: "spot_my_trades"
      }
    },
    facts: [],
    cursor_advancements: [
      {
        owner: "ledger:acct_1:spot_my_trades",
        cursor_key: "BTCUSDT",
        previous_cursor_value: "99",
        next_cursor_value: "100"
      }
    ]
  };
}

export function balanceSnapshotCommand(): LedgerIngestCommand {
  return mergeCommand(fixtureTradeCommand(), {
    batch: {
      ...fixtureTradeCommand().batch,
      idempotency_key: "batch_fixture_balance_001"
    },
    facts: [
      {
        kind: "account_balance_snapshot",
        idempotency_key: "snapshot_acct_1_btc_20260625_spot_total",
        natural_key: "acct_1:BTC:2026-06-25T00:00:00.000Z:spot_total",
        occurred_at: "2026-06-25T00:00:00.000Z",
        payload: {
          exchange_account_id: "acct_1",
          asset: "BTC",
          snapshot_time: "2026-06-25T00:00:00.000Z",
          reported_scope: "spot_total",
          free: "0.01000000",
          locked: "0.00000000"
        }
      }
    ]
  });
}

export function reversalCommand(targetKind: LedgerFactKind, targetIdempotencyKey: string): LedgerIngestCommand {
  return {
    batch: {
      idempotency_key: "batch_manual_reversal_001",
      source_mode: "live",
      default_origin: { kind: "manual_reversal" },
      actor: { kind: "user", user_id: "user_1" },
      trigger: { kind: "manual_reversal", request_id: "req_reversal_001" },
      requested_at: "2026-06-25T00:00:00.000Z"
    },
    facts: [
      {
        kind: "reversal",
        idempotency_key: `reversal:${targetKind}:${targetIdempotencyKey}`,
        natural_key: `reversal:${targetKind}:${targetIdempotencyKey}`,
        occurred_at: "2026-06-25T00:00:00.000Z",
        payload: {
          target_fact_kind: targetKind,
          target_fact_idempotency_key: targetIdempotencyKey,
          reason_code: "operator_correction"
        }
      }
    ]
  };
}

function mergeCommand(base: LedgerIngestCommand, overrides: Partial<LedgerIngestCommand>): LedgerIngestCommand {
  return {
    ...base,
    ...overrides,
    batch: overrides.batch ?? base.batch,
    facts: overrides.facts ?? base.facts,
    cursor_advancements: overrides.cursor_advancements ?? base.cursor_advancements
  };
}
