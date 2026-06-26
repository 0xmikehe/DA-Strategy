import { calculatePackageHash, verifyPackageHash } from "@/ledger/package/hash";
import { LedgerPackageValidationError, validateLedgerPackage } from "@/ledger/package/schema";
import type { LedgerExportPackage } from "@/ledger/package/types";

export function promotePackageToCassette(input: LedgerExportPackage, cassetteId: string): LedgerExportPackage {
  const ledgerPackage = verifyPackageHash(input);

  if (ledgerPackage.manifest.package_kind === "cassette" && ledgerPackage.manifest.cassette_id !== cassetteId) {
    throw new LedgerPackageValidationError(
      "LEDGER_CASSETTE_IMMUTABLE_ID",
      `cassette ${ledgerPackage.manifest.cassette_id} cannot be promoted as ${cassetteId}`
    );
  }

  if (!ledgerPackage.manifest.redaction_level) {
    throw new LedgerPackageValidationError("LEDGER_CASSETTE_REDACTION_REQUIRED", "cassettes require redaction_level");
  }

  const packageWithoutHash: LedgerExportPackage = {
    ...ledgerPackage,
    manifest: {
      ...ledgerPackage.manifest,
      package_kind: "cassette",
      cassette_id: cassetteId,
      source_env_id: "cassette-fixture",
      content_hash: ""
    }
  };

  return validateLedgerPackage({
    ...packageWithoutHash,
    manifest: {
      ...packageWithoutHash.manifest,
      content_hash: calculatePackageHash(packageWithoutHash)
    }
  });
}
