import { z } from "zod";

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url().startsWith("postgres://").or(z.url().startsWith("postgresql://")),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function readEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  return EnvironmentSchema.parse(input);
}
