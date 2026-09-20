import { readFile } from "node:fs/promises";
import { createPool } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { OnboardingService } from "@pact/onboarding";
import { readEnvironment } from "./config.js";
import { buildServer } from "./server.js";

const environment = readEnvironment();
const pool = createPool(environment.DATABASE_URL);
const clock = { now: () => new Date() };
const compromisedPasswordDigests = environment.COMPROMISED_PASSWORD_SHA256_FILE
  ? (await readFile(environment.COMPROMISED_PASSWORD_SHA256_FILE, "utf8"))
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter((value) => /^[0-9a-f]{64}$/i.test(value))
  : baselineCompromisedPasswordDigests;
const identity = new IdentityService(pool, {
  productScope: "pact",
  currentTermsVersion: environment.CURRENT_TERMS_VERSION,
  allowedOrigins: new Set([environment.PACT_ORIGIN]),
  clock,
  digester: new TokenDigester(Buffer.from(environment.IDENTITY_TOKEN_PEPPER, "base64url")),
  secretBox: new AesGcmSecretBox(Buffer.from(environment.IDENTITY_ENCRYPTION_KEY, "base64url")),
  compromisedPasswords: new LocalCompromisedPasswordChecker(compromisedPasswordDigests),
});
const onboarding = new OnboardingService(pool, {
  productScope: "pact",
  currentTermsVersion: environment.CURRENT_TERMS_VERSION,
  now: clock.now,
});
const server = buildServer(pool, { level: environment.LOG_LEVEL }, undefined, { identity, onboarding });

const shutdown = async (): Promise<void> => {
  await server.close();
  await pool.end();
};
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});

await server.listen({ host: environment.HOST, port: environment.PORT });
