export type LedgerIngestErrorCode =
  | "LEDGER_INGEST_VALIDATION_FAILED"
  | "LEDGER_INGEST_ORIGIN_REQUIRED"
  | "LEDGER_INGEST_IMPORT_METADATA_REQUIRED"
  | "LEDGER_INGEST_PACKAGE_METADATA_REQUIRED"
  | "LEDGER_INGEST_SYNC_METADATA_REQUIRED"
  | "LEDGER_INGEST_DECIMAL_STRING_REQUIRED"
  | "LEDGER_INGEST_DECIMAL_STRING_INVALID"
  | "LEDGER_INGEST_PAYLOAD_HASH_MISMATCH"
  | "LEDGER_INGEST_DIMENSION_CONFLICT"
  | "LEDGER_INGEST_FACTS_REQUIRED"
  | "LEDGER_INGEST_IDEMPOTENCY_CONFLICT"
  | "LEDGER_INGEST_FACT_CONFLICT"
  | "LEDGER_INGEST_REVERSAL_TARGET_NOT_FOUND"
  | "LEDGER_INGEST_REVERSAL_TARGET_ALREADY_REVERSED";

export class IngestValidationError extends Error {
  readonly code: LedgerIngestErrorCode;

  constructor(code: LedgerIngestErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "IngestValidationError";
    this.code = code;
  }
}

export class LedgerIngestConflictError extends Error {
  readonly code: LedgerIngestErrorCode;

  constructor(code: LedgerIngestErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "LedgerIngestConflictError";
    this.code = code;
  }
}
