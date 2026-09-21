import { readFile } from "node:fs/promises";
import { CommandDispatcher } from "@pact/application";
import { ApprovalService } from "@pact/approvals";
import { AuthorityService } from "@pact/authority";
import { ProductScopeSchema } from "@pact/contracts";
import { CredentialVaultService, RsaOaepPublicKeyWrapper } from "@pact/credential-vault";
import { createPool } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { InboxService } from "@pact/inbox";
import { McpTransport } from "@pact/mcp";
import { OAuthService } from "@pact/oauth";
import { OnboardingService } from "@pact/onboarding";
import { RunService } from "@pact/runs";
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
const dispatcher = new CommandDispatcher({
  pool,
  clock,
  productScope: ProductScopeSchema.parse("pact"),
});
const oauth = new OAuthService(pool, {
  productScope: "pact",
  issuer: environment.PACT_ORIGIN,
  mcpResource: `${environment.PACT_ORIGIN}/mcp`,
  humanResource: `${environment.PACT_ORIGIN}/native`,
  clock,
});
const authority = new AuthorityService(pool, { productScope: "pact", identity, now: clock.now });
const mcp = new McpTransport({
  pool,
  productScope: "pact",
  dispatcher,
  origin: environment.PACT_ORIGIN,
  clock,
});
const approvals = new ApprovalService(pool, {
  productScope: "pact",
  identity,
  dispatcher,
  clock,
  origin: environment.PACT_ORIGIN,
});
const inbox = new InboxService(pool, { productScope: "pact", clock });
const runs = new RunService(pool, { productScope: "pact", clock, inbox });
const credentialVault = environment.MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE
  ? new CredentialVaultService(pool, {
      productScope: "pact",
      clock,
      wrapper: new RsaOaepPublicKeyWrapper(
        await readFile(environment.MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE, "utf8"),
        environment.MODEL_CREDENTIAL_WRAPPING_KEY_ID,
      ),
    })
  : undefined;
const server = buildServer(pool, { level: environment.LOG_LEVEL }, undefined, {
  identity,
  onboarding,
  dispatcher,
  oauth,
  authority,
  mcp,
  approvals,
  inbox,
  runs,
  ...(credentialVault ? { credentialVault } : {}),
  origin: environment.PACT_ORIGIN,
});

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
