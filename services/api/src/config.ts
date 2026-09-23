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
    PACT_PUBLIC_BASE_URL: z.url().optional(),
    CURRENT_TERMS_VERSION: z.string().min(1).max(64).default("development-v1"),
    IDENTITY_TOKEN_PEPPER: z.string().min(43).default(developmentPepper),
    IDENTITY_ENCRYPTION_KEY: z.string().min(43).default(developmentEncryptionKey),
    COMPROMISED_PASSWORD_SHA256_FILE: z.string().min(1).optional(),
    MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE: z.string().min(1).optional(),
    MODEL_CREDENTIAL_WRAPPING_KEY_ID: z.string().min(1).max(128).default("vps-primary-v1"),
    TELEGRAM_BOT_ID: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(16).optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(32).max(256).optional(),
    PACT_DELETION_REGISTRY_FILE: z.string().min(1).optional(),
    PACT_OPERATOR_REGISTER_FILE: z.string().min(1).optional(),
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
    if (value.NODE_ENV === "production" && !value.MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE) {
      context.addIssue({ code: "custom", message: "Production model-credential public wrapping key is required" });
    }
    if (value.NODE_ENV === "production" && !value.PACT_DELETION_REGISTRY_FILE) {
      context.addIssue({ code: "custom", message: "Production deletion registry file is required" });
    }
    const telegramValues = [value.TELEGRAM_BOT_ID, value.TELEGRAM_BOT_TOKEN, value.TELEGRAM_WEBHOOK_SECRET];
    if (telegramValues.some(Boolean) && !telegramValues.every(Boolean)) {
      context.addIssue({ code: "custom", message: "Telegram bot configuration must be supplied as a complete set" });
    }
    if (
      value.PACT_PUBLIC_BASE_URL &&
      new URL(value.PACT_PUBLIC_BASE_URL).origin !== new URL(value.PACT_ORIGIN).origin
    ) {
      context.addIssue({ code: "custom", message: "PACT_PUBLIC_BASE_URL must use PACT_ORIGIN" });
    }
  });

export type Environment = z.infer<typeof EnvironmentSchema>;

export function readEnvironment(input: Record<string, string | undefined> = process.env): Environment {
  return EnvironmentSchema.parse(input);
}
