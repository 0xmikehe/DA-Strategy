import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runLedgerPackageCli } from "@/ledger/package/cli";
import { verifyPackageHash } from "@/ledger/package/hash";

describe("ledger package CLI", () => {
  it("writes mock packages and promotes cassettes offline", async () => {
    const tmpDir = path.join(process.cwd(), "tmp/ledger/cli-test");
    const mockPath = path.join(tmpDir, "deposit_buy_fee.json");
    const cassettePath = path.join(tmpDir, "cassette_deposit_buy_fee.json");
    const messages: string[] = [];

    await mkdir(tmpDir, { recursive: true });

    await runLedgerPackageCli(["mock-package", "--scenario", "deposit_buy_fee", "--out", mockPath], {
      stdout: (message) => messages.push(message)
    });
    const mockPackage = verifyPackageHash(JSON.parse(await readFile(mockPath, "utf8")));

    await runLedgerPackageCli(
      ["cassette-promote", "--file", mockPath, "--cassette-id", "cassette_cli_deposit_buy_fee", "--out", cassettePath],
      {
        stdout: (message) => messages.push(message)
      }
    );
    const cassettePackage = verifyPackageHash(JSON.parse(await readFile(cassettePath, "utf8")));

    expect(mockPackage.manifest.package_kind).toBe("mock");
    expect(cassettePackage.manifest.package_kind).toBe("cassette");
    expect(cassettePackage.manifest.cassette_id).toBe("cassette_cli_deposit_buy_fee");
    expect(messages).toEqual([mockPath, cassettePath]);
  });
});
