import { describe, expect, it } from "vitest";
import { IngestValidationError, canonicalHash, validateLedgerIngestCommand } from "@/ledger/ingest";
import { balanceSnapshotCommand, fixtureTradeCommand, liveEmptyCursorCommand, remoteImportCommand } from "./builders";

describe("ledger ingest validation", () => {
  it("accepts a valid fixture command, resolves default origin, and projects dimensions", () => {
    const command = validateLedgerIngestCommand(fixtureTradeCommand());

    expect(command.batch.source_mode).toBe("fixture");
    expect(command.facts[0]?.origin).toEqual({ kind: "fixture", fixture_id: "fixture_p2_0" });
    expect(command.facts[0]?.dimensions).toMatchObject({
      exchange_account_id: "acct_1",
      strategy_id: "core_allocation_lt",
      strategy_version: "v1",
      snapshot_id: "snap_001",
      asset: "BTC",
      symbol: "BTCUSDT"
    });
  });

  it("rejects commands without source mode", () => {
    const invalid = {
      ...fixtureTradeCommand(),
      batch: { ...fixtureTradeCommand().batch, source_mode: undefined }
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow(IngestValidationError);
  });

  it("rejects missing origin on facts without a batch default", () => {
    const invalid = {
      ...fixtureTradeCommand(),
      batch: { ...fixtureTradeCommand().batch, default_origin: undefined }
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_ORIGIN_REQUIRED");
  });

  it("rejects remote imports without package and import metadata", () => {
    const invalid = {
      ...remoteImportCommand(),
      batch: {
        ...remoteImportCommand().batch,
        package_metadata: undefined,
        import_metadata: undefined
      }
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_IMPORT_METADATA_REQUIRED");
  });

  it("rejects live Binance facts without sync metadata", () => {
    const invalid = {
      ...fixtureTradeCommand(),
      batch: {
        ...fixtureTradeCommand().batch,
        source_mode: "live",
        default_origin: { kind: "binance_user_data", endpoint: "GET /api/v3/myTrades" },
        actor: { kind: "system", name: "ledger-worker" },
        trigger: { kind: "scheduled_sync", job_run_id: "job_1" }
      }
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_SYNC_METADATA_REQUIRED");
  });

  it("rejects live cursor advancement batches without sync metadata", () => {
    const invalid = {
      ...liveEmptyCursorCommand(),
      batch: {
        ...liveEmptyCursorCommand().batch,
        sync_metadata: undefined
      }
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_SYNC_METADATA_REQUIRED");
  });

  it("rejects numeric financial values in payloads", () => {
    const invalid = {
      ...fixtureTradeCommand(),
      facts: [
        {
          ...fixtureTradeCommand().facts[0],
          payload: {
            ...fixtureTradeCommand().facts[0]?.payload,
            price: 65000
          }
        }
      ]
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_DECIMAL_STRING_REQUIRED");
  });

  it("rejects invalid decimal strings in known financial payload fields", () => {
    const invalid = {
      ...fixtureTradeCommand(),
      facts: [
        {
          ...fixtureTradeCommand().facts[0],
          payload: {
            ...fixtureTradeCommand().facts[0]?.payload,
            price: "not-a-decimal"
          }
        }
      ]
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_DECIMAL_STRING_INVALID");
  });

  it("rejects payload hashes that do not match canonical payload", () => {
    const invalid = {
      ...fixtureTradeCommand(),
      facts: [
        {
          ...fixtureTradeCommand().facts[0],
          payload_hash: "sha256:not-the-payload"
        }
      ]
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_PAYLOAD_HASH_MISMATCH");
  });

  it("rejects dimensions that conflict with payload dimensions", () => {
    const invalid = {
      ...fixtureTradeCommand(),
      facts: [
        {
          ...fixtureTradeCommand().facts[0],
          dimensions: {
            exchange_account_id: "different_account"
          }
        }
      ]
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_DIMENSION_CONFLICT");
  });

  it("requires reported_scope for account balance snapshots", () => {
    const invalid = {
      ...balanceSnapshotCommand(),
      facts: [
        {
          ...balanceSnapshotCommand().facts[0],
          payload: {
            ...balanceSnapshotCommand().facts[0]?.payload,
            reported_scope: undefined
          }
        }
      ]
    };

    expect(() => validateLedgerIngestCommand(invalid)).toThrow("LEDGER_INGEST_DIMENSION_CONFLICT");
  });

  it("canonical hash is stable regardless of object key order", () => {
    expect(canonicalHash({ b: "2", a: "1" })).toBe(canonicalHash({ a: "1", b: "2" }));
  });
});
