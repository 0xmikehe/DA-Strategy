import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type EnvMap = Record<string, string | undefined>;

export type LoadLocalEnvOptions = {
  cwd?: string;
  env?: EnvMap;
  files?: string[];
  override?: boolean;
};

export type LoadLocalEnvResult = {
  loadedFiles: string[];
};

const defaultEnvFiles = [".env", ".env.local"];

export function loadLocalEnv(options: LoadLocalEnvOptions = {}): LoadLocalEnvResult {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const files = options.files ?? defaultEnvFiles;
  const override = options.override ?? false;
  const loadedFiles: string[] = [];

  for (const file of files) {
    const filePath = join(cwd, file);
    if (!existsSync(filePath)) {
      continue;
    }

    applyEnvFile(readFileSync(filePath, "utf8"), env, override);
    loadedFiles.push(filePath);
  }

  return { loadedFiles };
}

function applyEnvFile(content: string, env: EnvMap, override: boolean) {
  for (const rawLine of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(rawLine);
    if (!parsed) {
      continue;
    }

    if (override || env[parsed.key] === undefined) {
      env[parsed.key] = parsed.value;
    }
  }
}

function parseEnvLine(rawLine: string): { key: string; value: string } | null {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) {
    return null;
  }

  const normalizedLine = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
  const separatorIndex = normalizedLine.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalizedLine.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return {
    key,
    value: normalizeEnvValue(normalizedLine.slice(separatorIndex + 1).trim())
  };
}

function normalizeEnvValue(value: string) {
  const quote = value[0];
  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }

  return value;
}
