import { z } from "zod";

const developmentPepper = "CqWSQq6gBenmbgNM7GRZsQuPkj4EgO0psoaTUmteeK0";
const developmentEncryptionKey = "PzS19vXA8bs49_7DwIY8nKGkQUmVXdmOrFoQ-1pe4LA";

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url().startsWith("postgres://").or(z.url().startsWith("postgresql://")),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    PACT_ORIGIN: z.url().default("http://127.0.0.1:5173"),
    CURRENT_TERMS_VERSION: z.string().min(1).max(64).default("development-v1"),
    IDENTITY_TOKEN_PEPPER: z.string().min(43).default(developmentPepper),
    IDENTITY_ENCRYPTION_KEY: z.string().min(43).default(developmentEncryptionKey),
    COMPROMISED_PASSWORD_SHA256_FILE: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      (value.IDENTITY_TOKEN_PEPPER === developmentPepper || value.IDENTITY_ENCRYPTION_KEY === developmentEncryptionKey)
    ) {
      context.addIssue({ code: "custom", message: "Production identity secrets must be explicitly configured" });
    }
    if (value.NODE_ENV === "production" && !value.COMPROMISED_PASSWORD_SHA256_FILE) {
      context.addIssue({ code: "custom", message: "Production compromised-password digest file is required" });
    }
  });

export type Environment = z.infer<typeof EnvironmentSchema>;

export function readEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  return EnvironmentSchema.parse(input);
}
