import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv } from "@/server/config/env";

const tmpDirs: string[] = [];
const localDatabaseUrl =
  "postgresql://digital_asset:digital_asset_dev@127.0.0.1:55432/digital_asset_dev?schema=public";

async function makeTempCwd() {
  const dir = await mkdtemp(join(tmpdir(), "digital-asset-env-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("getServerEnv", () => {
  it("loads DATABASE_URL from a local .env file for standalone Node processes", async () => {
    const cwd = await makeTempCwd();
    await writeFile(join(cwd, ".env"), `DATABASE_URL="${localDatabaseUrl}"\n`);

    expect(getServerEnv({ cwd, env: {} }).DATABASE_URL).toBe(localDatabaseUrl);
  });

  it("keeps an existing DATABASE_URL unless override is explicitly requested", async () => {
    const cwd = await makeTempCwd();
    await writeFile(join(cwd, ".env"), `DATABASE_URL="${localDatabaseUrl}"\n`);

    const env = {
      DATABASE_URL: "postgresql://example:example@localhost:5432/example?schema=public"
    };

    expect(getServerEnv({ cwd, env }).DATABASE_URL).toBe(env.DATABASE_URL);
  });
});
