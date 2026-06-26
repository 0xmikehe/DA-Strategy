import { canonicalHash } from "@/ledger/ingest";
import { LedgerPackageValidationError, validateLedgerPackage } from "./schema";
import type { LedgerExportPackage } from "./types";

export function packageContentForHash(ledgerPackage: LedgerExportPackage): LedgerExportPackage {
  return {
    ...ledgerPackage,
    manifest: {
      ...ledgerPackage.manifest,
      content_hash: ""
    }
  };
}

export function calculatePackageHash(ledgerPackage: LedgerExportPackage): string {
  return canonicalHash(packageContentForHash(ledgerPackage));
}

export function verifyPackageHash(input: unknown): LedgerExportPackage {
  const ledgerPackage = validateLedgerPackage(input);
  const expectedHash = calculatePackageHash(ledgerPackage);

  if (ledgerPackage.manifest.content_hash !== expectedHash) {
    throw new LedgerPackageValidationError(
      "LEDGER_PACKAGE_HASH_MISMATCH",
      `expected ${expectedHash} but received ${ledgerPackage.manifest.content_hash}`
    );
  }

  return ledgerPackage;
}
