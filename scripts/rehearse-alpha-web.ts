// Local-only, isolated PostgreSQL fixtures; never points at the hosted world.
import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { KingdomService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { OnboardingService } from "@pact/onboarding";
import { WorldClockService } from "@pact/world";

const connection = "postgres://pact:pact@127.0.0.1:5432/pact_test";
const admin = createPool(connection);
const schema = await createTestSchema(admin, "web_rehearsal");
const pool = createSchemaPool(connection, schema);
const clock = { now: () => new Date() };
const secretBox = new AesGcmSecretBox(Buffer.from("PzS19vXA8bs49_7DwIY8nKGkQUmVXdmOrFoQ-1pe4LA", "base64url"));
const identity = new IdentityService(pool, {
  productScope: "pact",
  currentTermsVersion: "development-v1",
  allowedOrigins: new Set(["http://127.0.0.1:5174"]),
  clock,
  digester: new TokenDigester(Buffer.from("CqWSQq6gBenmbgNM7GRZsQuPkj4EgO0psoaTUmteeK0", "base64url")),
  secretBox,
  compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
});
const onboarding = new OnboardingService(pool, {
  productScope: "pact",
  currentTermsVersion: "development-v1",
  now: clock.now,
});
const world = new WorldClockService(pool, "pact");
await world.bootstrap();
await pool.query("UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '1 hour'");
const ledger = new ResourceLedger("pact");
const kingdoms = new KingdomService(pool, { productScope: "pact", onboarding, world, ledger });
for (const handle of ["rehearsal_amber", "rehearsal_birch"]) {
  await identity.signup({
    email: `${handle}@example.test`,
    password: "Synthetic rehearsal password 123!",
    age18Declared: true,
    acceptedTermsVersion: "development-v1",
  });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    "SELECT payload FROM outbox_events WHERE type='security.email.requested.v1' ORDER BY id DESC LIMIT 1",
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("Fixture verification missing");
  await identity.verifyEmail(Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8"));
  const draft = await onboarding.ensureDraft(payload.accountId);
  await onboarding.updateDraft(payload.accountId, {
    displayName: handle,
    proposedHandle: handle,
    portrait: "portrait.wolf",
    expectedVersion: draft.version,
  });
  await onboarding.recordConnectionCheck(payload.accountId);
  const founded = await kingdoms.activate(payload.accountId);
  // Explicit synthetic ordinary stock, not an advertised founding entitlement.
  await withTransaction(pool, async (c) => {
    for (const resource of ["grain", "iron", "silver"] as const)
      await ledger.creditOrdinary(c, {
        kingdomId: founded.kingdomId,
        resource,
        amount: wholeResources(100),
        operationKey: randomUUID(),
        reason: "local_rehearsal_fixture",
        gameTimeMs: 0,
      });
  });
}
await pool.end();
await admin.end();
const url = new URL(connection);
url.searchParams.set("options", `-c search_path=${schema},public`);
Object.assign(process.env, {
  DATABASE_URL: url.toString(),
  NODE_ENV: "development",
  HOST: "127.0.0.1",
  PORT: "3017",
  PACT_ORIGIN: "http://127.0.0.1:5174",
  CURRENT_TERMS_VERSION: "development-v1",
  LOG_LEVEL: "silent",
});
for (const key of [
  "PACT_PUBLIC_BASE_URL",
  "IDENTITY_TOKEN_PEPPER",
  "IDENTITY_ENCRYPTION_KEY",
  "TELEGRAM_BOT_ID",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "PACT_OPERATOR_REGISTER_FILE",
  "PACT_DELETION_REGISTRY_FILE",
  "MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE",
  "COMPROMISED_PASSWORD_SHA256_FILE",
  "RAID_SEED_ENCRYPTION_KEY_BASE64",
])
  delete process.env[key];
process.env.RAID_SEED_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 7).toString("base64");
console.log(
  `Local isolated rehearsal: ${schema}. Rules worker heartbeats; the first tick is delayed one hour for pending-state inspection. No inference worker or paid calls. Synthetic stock is explicit. See docs/operations/alpha-web.md for login and cleanup.`,
);
await import("../workers/rules/src/main.js");
await import("../services/api/src/main.js");
