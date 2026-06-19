import { z } from "zod";
import { type EnvMap, type LoadLocalEnvOptions, loadLocalEnv } from "./local-env-loader";

const ServerEnvSchema = z.object({
  DATABASE_URL: z.string().url()
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export type GetServerEnvOptions = LoadLocalEnvOptions;

export function parseServerEnv(env: EnvMap = process.env): ServerEnv {
  return ServerEnvSchema.parse(env);
}

export function getServerEnv(options: GetServerEnvOptions = {}): ServerEnv {
  const env = options.env ?? process.env;
  loadLocalEnv({ ...options, env });
  return parseServerEnv(env);
}
