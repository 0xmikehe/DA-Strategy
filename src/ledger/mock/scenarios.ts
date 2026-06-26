import type { LedgerPackageSourceFactRow, LedgerPackageSummaryRow } from "@/ledger/package/types";

export const mockLedgerScenarioIds = [
  "empty_healthy_account",
  "deposit_buy_fee",
  "partial_sell_lot",
  "master_to_sub_transfer",
  "missing_event_mismatch",
  "external_wallet_pending_attribution",
  "duplicate_import",
  "mixed_origin_package"
] as const;

export type MockLedgerScenarioId = (typeof mockLedgerScenarioIds)[number];

export type MockLedgerScenarioDefinition = {
  exchange_accounts?: LedgerPackageSummaryRow[];
  api_key_health_summaries?: LedgerPackageSummaryRow[];
  exchange_trade_fills?: LedgerPackageSourceFactRow[];
  exchange_orders?: LedgerPackageSourceFactRow[];
  capital_flow_events?: LedgerPackageSourceFactRow[];
  external_trades?: LedgerPackageSourceFactRow[];
  attribution_records?: LedgerPackageSourceFactRow[];
  reversals?: LedgerPackageSourceFactRow[];
  account_balance_snapshots?: LedgerPackageSourceFactRow[];
  reconciliation_results?: LedgerPackageSummaryRow[];
  sync_cursor_summaries?: LedgerPackageSummaryRow[];
  raw_payload_redacted?: LedgerPackageSummaryRow[];
};

export const mockLedgerPackageProducedAt = "2026-06-25T00:00:00.000Z";

const mockAccount = {
  exchange_account_id: "acct_mock_core_spot",
  exchange: "BINANCE",
  account_scope: "spot",
  label: "Mock Core Spot",
  status: "active"
};

const healthyKeySummary = {
  credential_ref: "cred_mock_core_spot",
  exchange_account_id: "acct_mock_core_spot",
  status: "healthy",
  checked_at: mockLedgerPackageProducedAt,
  permissions: ["read_only"]
};

export const mockLedgerScenarios: Record<MockLedgerScenarioId, MockLedgerScenarioDefinition> = {
  empty_healthy_account: {
    exchange_accounts: [mockAccount],
    api_key_health_summaries: [healthyKeySummary]
  },
  deposit_buy_fee: {
    exchange_accounts: [mockAccount],
    api_key_health_summaries: [healthyKeySummary],
    capital_flow_events: [
      fact("deposit_buy_fee", "flow:acct_mock_core_spot:deposit:dep_001", "2026-06-25T00:01:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        external_id: "dep_001",
        asset: "USDT",
        flow_type: "deposit",
        amount: "1000.00",
        status: "confirmed"
      })
    ],
    exchange_trade_fills: [
      fact("deposit_buy_fee", "fill:acct_mock_core_spot:BTCUSDT:100", "2026-06-25T00:02:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        strategy_id: "core_allocation_lt",
        strategy_version: "v1",
        snapshot_id: "snap_mock_001",
        asset: "BTC",
        base_asset: "BTC",
        quote_asset: "USDT",
        symbol: "BTCUSDT",
        side: "BUY",
        trade_id: "100",
        order_id: "500",
        price: "65000.00",
        qty: "0.01000000",
        quote_qty: "650.00",
        commission: "0.00001000",
        commission_asset: "BTC"
      })
    ],
    account_balance_snapshots: [
      fact("deposit_buy_fee", "snapshot:acct_mock_core_spot:BTC:2026-06-25T00:03:00.000Z:spot_total", "2026-06-25T00:03:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        asset: "BTC",
        snapshot_time: "2026-06-25T00:03:00.000Z",
        reported_scope: "spot_total",
        free: "0.00999000",
        locked: "0.00000000"
      })
    ]
  },
  partial_sell_lot: {
    exchange_trade_fills: [
      fact("partial_sell_lot", "fill:acct_mock_core_spot:ETHUSDT:200", "2026-06-25T00:04:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        asset: "ETH",
        base_asset: "ETH",
        quote_asset: "USDT",
        symbol: "ETHUSDT",
        side: "BUY",
        trade_id: "200",
        price: "3500.00",
        qty: "1.00000000",
        quote_qty: "3500.00",
        commission: "0.00100000",
        commission_asset: "ETH"
      }),
      fact("partial_sell_lot", "fill:acct_mock_core_spot:ETHUSDT:201", "2026-06-25T00:05:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        asset: "ETH",
        base_asset: "ETH",
        quote_asset: "USDT",
        symbol: "ETHUSDT",
        side: "SELL",
        trade_id: "201",
        price: "3600.00",
        qty: "0.40000000",
        quote_qty: "1440.00",
        commission: "1.44",
        commission_asset: "USDT"
      })
    ]
  },
  master_to_sub_transfer: {
    capital_flow_events: [
      fact("master_to_sub_transfer", "flow:master:to:acct_mock_core_spot:usdt:001", "2026-06-25T00:06:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        external_id: "transfer_001",
        asset: "USDT",
        flow_type: "master_to_sub_transfer",
        amount: "5000.00",
        status: "confirmed"
      })
    ]
  },
  missing_event_mismatch: {
    account_balance_snapshots: [
      fact("missing_event_mismatch", "snapshot:acct_mock_core_spot:USDT:2026-06-25T00:07:00.000Z:spot_total", "2026-06-25T00:07:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        asset: "USDT",
        snapshot_time: "2026-06-25T00:07:00.000Z",
        reported_scope: "spot_total",
        free: "9999.00",
        locked: "0.00"
      })
    ]
  },
  external_wallet_pending_attribution: {
    external_trades: [
      fact("external_wallet_pending_attribution", "external:wallet:eth:001", "2026-06-25T00:08:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        external_id: "wallet_trade_001",
        asset: "ETH",
        side: "BUY",
        amount: "0.50000000",
        quote_asset: "USDT",
        quote_qty: "1750.00",
        attribution_status: "pending"
      })
    ]
  },
  duplicate_import: {
    exchange_trade_fills: [
      fact("duplicate_import", "fill:acct_mock_core_spot:BTCUSDT:dup_100", "2026-06-25T00:09:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        asset: "BTC",
        base_asset: "BTC",
        quote_asset: "USDT",
        symbol: "BTCUSDT",
        side: "BUY",
        trade_id: "dup_100",
        price: "64000.00",
        qty: "0.00500000",
        quote_qty: "320.00",
        commission: "0.00000500",
        commission_asset: "BTC"
      })
    ]
  },
  mixed_origin_package: {
    exchange_trade_fills: [
      fact("mixed_origin_package", "fill:acct_mock_core_spot:SOLUSDT:300", "2026-06-25T00:10:00.000Z", {
        exchange_account_id: "acct_mock_core_spot",
        asset: "SOL",
        base_asset: "SOL",
        quote_asset: "USDT",
        symbol: "SOLUSDT",
        side: "BUY",
        trade_id: "300",
        price: "130.00",
        qty: "10.00000000",
        quote_qty: "1300.00",
        commission: "0.01000000",
        commission_asset: "SOL"
      })
    ],
    attribution_records: [
      {
        ...fact("mixed_origin_package", "attribution:manual:SOLUSDT:300", "2026-06-25T00:11:00.000Z", {
          exchange_account_id: "acct_mock_core_spot",
          external_id: "manual_attr_001",
          strategy_id: "core_allocation_lt",
          strategy_version: "v1",
          reason_code: "operator_backfill"
        }),
        origin: { kind: "manual_attribution" },
        trigger: { kind: "manual_attribution", request_id: "req_mock_manual_attr_001" }
      }
    ]
  }
};

function fact(
  scenarioId: MockLedgerScenarioId,
  naturalKey: string,
  occurredAt: string,
  payload: Record<string, unknown>
): LedgerPackageSourceFactRow {
  return {
    idempotency_key: naturalKey.replaceAll(":", "_"),
    natural_key: naturalKey,
    origin: { kind: "mock_scenario", scenario_id: scenarioId },
    occurred_at: occurredAt,
    payload
  };
}
