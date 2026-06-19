import { z } from "zod";

const ServerEnvSchema = z.object({
  DATABASE_URL: z.string().url()
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return ServerEnvSchema.parse(env);
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv();
}
