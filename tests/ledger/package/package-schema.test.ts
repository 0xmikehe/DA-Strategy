import { describe, expect, it } from "vitest";
import { calculatePackageHash, verifyPackageHash } from "@/ledger/package/hash";
import { LedgerPackageValidationError, validateLedgerPackage } from "@/ledger/package/schema";
import type { LedgerExportPackage } from "@/ledger/package/types";

describe("ledger package schema and hash", () => {
  it("validates a ledger.export.v1 package with all required sections", () => {
    const ledgerPackage = packageWithHash(basePackage());

    const parsed = validateLedgerPackage(ledgerPackage);

    expect(parsed.manifest.schema_version).toBe("ledger.export.v1");
    expect(parsed.exchange_trade_fills).toHaveLength(1);
    expect(parsed.exchange_orders).toEqual([]);
    expect(parsed.raw_payload_redacted).toEqual([]);
  });

  it("rejects JS numbers for known decimal-like fields", () => {
    const ledgerPackage = packageWithHash({
      ...basePackage(),
      exchange_trade_fills: [
        {
          ...basePackage().exchange_trade_fills[0],
          payload: {
            ...basePackage().exchange_trade_fills[0]?.payload,
            price: 65000
          }
        }
      ]
    });

    expect(() => validateLedgerPackage(ledgerPackage)).toThrow(LedgerPackageValidationError);
    expect(() => validateLedgerPackage(ledgerPackage)).toThrow("LEDGER_PACKAGE_DECIMAL_STRING_REQUIRED");
  });

  it("verifies content_hash for canonical package content", () => {
    const ledgerPackage = packageWithHash(basePackage());

    expect(verifyPackageHash(ledgerPackage)).toEqual(ledgerPackage);
  });

  it("rejects tampered package content before ingestion", () => {
    const ledgerPackage = packageWithHash(basePackage());
    const tampered = {
      ...ledgerPackage,
      exchange_trade_fills: [
        {
          ...ledgerPackage.exchange_trade_fills[0],
          payload: {
            ...ledgerPackage.exchange_trade_fills[0]?.payload,
            qty: "0.02000000"
          }
        }
      ]
    };

    expect(() => verifyPackageHash(tampered)).toThrow("LEDGER_PACKAGE_HASH_MISMATCH");
  });

  it("rejects secret-like fields anywhere in the package", () => {
    const ledgerPackage = packageWithHash({
      ...basePackage(),
      raw_payload_redacted: [
        {
          apiSecret: "must-not-be-committed"
        }
      ]
    });

    expect(() => validateLedgerPackage(ledgerPackage)).toThrow("LEDGER_PACKAGE_SECRET_FIELD");
  });
});

function basePackage(): LedgerExportPackage {
  return {
    manifest: {
      schema_version: "ledger.export.v1",
      package_id: "pkg_p2_1_deposit_buy_fee",
      package_kind: "mock",
      export_run_id: "lexp_mock_deposit_buy_fee",
      source_env_id: "mock-local",
      sync_run_id: "job_mock_deposit_buy_fee",
      scenario_id: "deposit_buy_fee",
      produced_at: "2026-06-25T00:00:00.000Z",
      content_hash: "",
      redaction_level: "none"
    },
    exchange_accounts: [],
    api_key_health_summaries: [],
    exchange_trade_fills: [
      {
        idempotency_key: "fill_acct_1_btcusdt_100",
        natural_key: "acct_1:BTCUSDT:100",
        origin: { kind: "mock_scenario", scenario_id: "deposit_buy_fee" },
        occurred_at: "2026-06-25T00:01:00.000Z",
        payload: {
          exchange_account_id: "acct_1",
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
    ],
    exchange_orders: [],
    capital_flow_events: [],
    external_trades: [],
    attribution_records: [],
    reversals: [],
    account_balance_snapshots: [],
    reconciliation_results: [],
    sync_cursor_summaries: [],
    raw_payload_redacted: []
  };
}

function packageWithHash(ledgerPackage: LedgerExportPackage): LedgerExportPackage {
  const withoutHash = {
    ...ledgerPackage,
    manifest: {
      ...ledgerPackage.manifest,
      content_hash: ""
    }
  };

  return {
    ...withoutHash,
    manifest: {
      ...withoutHash.manifest,
      content_hash: calculatePackageHash(withoutHash)
    }
  };
}
