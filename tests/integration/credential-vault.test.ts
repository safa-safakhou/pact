import { generateKeyPairSync, randomUUID } from "node:crypto";
import { CommandDispatcher } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import {
  CredentialResolver,
  CredentialVaultService,
  RsaOaepPrivateKeyUnwrapper,
  RsaOaepPublicKeyWrapper,
} from "@pact/credential-vault";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { OpenAiResponsesAdapter, ProviderRouter } from "@pact/model-provider";
import { OnboardingService } from "@pact/onboarding";
import { RunService } from "@pact/runs";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../../services/api/src/server.js";
import { createVaultBoundCredentialUse } from "../../workers/inference/src/credential-access.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const origin = "https://pact.example";
const baseTime = new Date("2026-09-21T10:00:00.000Z");
let now = new Date(baseTime);
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let vault: CredentialVaultService;
let resolver: CredentialResolver;
let digester: TokenDigester;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "credential_vault");
  pool = createSchemaPool(connectionString, schema);
  const clock = { now: () => new Date(now) };
  digester = new TokenDigester(Buffer.alloc(32, 17));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set([origin]),
    clock,
    digester,
    secretBox: new AesGcmSecretBox(Buffer.alloc(32, 19)),
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  const keys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  vault = new CredentialVaultService(pool, {
    productScope: "pact",
    clock,
    wrapper: new RsaOaepPublicKeyWrapper(keys.publicKey, "fixture-v1"),
  });
  resolver = new CredentialResolver(pool, {
    productScope: "pact",
    clock,
    unwrapper: new RsaOaepPrivateKeyUnwrapper(keys.privateKey, new Set(["fixture-v1"])),
  });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function accountFixture(): Promise<{
  accountId: string;
  sessionToken: string;
  csrfToken: string;
}> {
  const account = await pool.query<{ id: string }>(
    `INSERT INTO accounts(product_scope, email, password_hash, email_verified_at, status)
     VALUES ('pact', $1, 'fixture', $2, 'active') RETURNING id`,
    [`${randomUUID()}@example.test`, now],
  );
  const accountId = account.rows[0]?.id;
  if (!accountId) throw new Error("Account fixture missing");
  const sessionToken = randomUUID();
  const csrfToken = randomUUID();
  await pool.query(
    `INSERT INTO sessions(
       product_scope, account_id, audience, token_hash, csrf_token_hash, expires_at,
       idle_expires_at, authenticated_at, last_seen_at
     ) VALUES ('pact', $1, 'human', $2, $3, $4, $4, $5, $5)`,
    [accountId, digester.digest(sessionToken), digester.digest(csrfToken), new Date(now.getTime() + 86_400_000), now],
  );
  return { accountId, sessionToken, csrfToken };
}

function headers(fixture: { sessionToken: string; csrfToken: string }, write = true): Record<string, string> {
  return {
    cookie: `pact_session=${encodeURIComponent(fixture.sessionToken)}`,
    ...(write ? { origin, "x-csrf-token": fixture.csrfToken } : {}),
  };
}

describe("model credential vault", () => {
  it("executes a bounded run through a vault-scoped adapter without network access", async () => {
    now = new Date(baseTime);
    const owner = await accountFixture();
    const saved = await vault.save(owner.accountId, {
      provider: "openai",
      label: "Synthetic model connection",
      credential: "sk-synthetic-local-only",
    });
    const requests: string[] = [];
    const runs = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => new Date(now) },
      providerRouter: new ProviderRouter([
        new OpenAiResponsesAdapter({
          fetch: async (_url, init) => {
            requests.push(String(new Headers(init.headers).get("authorization")));
            return Response.json({
              id: "local-fixture",
              status: "completed",
              output: [{ type: "message", content: [{ type: "output_text", text: "Local fixture response" }] }],
              usage: { input_tokens: 21, output_tokens: 8 },
            });
          },
        }),
      ]),
      withCredential: createVaultBoundCredentialUse(resolver),
    });
    const started = await runs.start({
      accountId: owner.accountId,
      objective: "Local fixture only",
      provider: "openai",
      model: "gpt-4.1-mini",
      credentialId: saved.id,
      limits: { maxCalls: 1 },
    });
    const completed = await runs.executeModelCall(started.runId);
    const uses = await pool.query<{ status: string }>(
      "SELECT status FROM model_credential_uses WHERE credential_id = $1",
      [saved.id],
    );
    expect(uses.rows).toEqual([{ status: "completed" }]);
    expect(requests).toEqual(["Bearer sk-synthetic-local-only"]);
    expect(completed).toMatchObject({ status: "finished", modelCalls: 1, lastErrorCode: null });

    const wrongProvider = await vault.save(owner.accountId, {
      provider: "anthropic",
      label: "Wrong provider fixture",
      credential: "synthetic-anthropic-only",
    });
    const mismatched = await runs.start({
      accountId: owner.accountId,
      objective: "Do not send this to OpenAI",
      provider: "openai",
      model: "gpt-4.1-mini",
      credentialId: wrongProvider.id,
      limits: { maxCalls: 1 },
    });
    await expect(runs.executeModelCall(mismatched.runId)).resolves.toMatchObject({
      status: "failed",
      lastErrorCode: "INVALID_CREDENTIAL",
      ambiguousCrash: false,
    });
    expect(requests).toHaveLength(1);
  });

  it("binds inference use to the authenticated owner and selected provider", async () => {
    now = new Date(baseTime);
    const owner = await accountFixture();
    const other = await accountFixture();
    const saved = await vault.save(owner.accountId, {
      provider: "openai",
      label: "Synthetic only",
      credential: "sk-synthetic-fixture",
    });
    const use = createVaultBoundCredentialUse(resolver);
    let invoked = 0;
    const invoke = async (credential: Uint8Array) => {
      invoked += 1;
      expect(Buffer.from(credential).toString("utf8")).toBe("sk-synthetic-fixture");
      return "local-fixture-response";
    };
    await expect(use(other.accountId, saved.id, "openai", invoke)).rejects.toMatchObject({
      code: "INVALID_CREDENTIAL",
    });
    await expect(use(owner.accountId, saved.id, "anthropic", invoke)).rejects.toMatchObject({
      code: "INVALID_CREDENTIAL",
    });
    expect(invoked).toBe(0);
    await expect(use(owner.accountId, saved.id, "openai", invoke)).resolves.toBe("local-fixture-response");
    expect(invoked).toBe(1);
    const uses = await pool.query<{ status: string }>(
      "SELECT status FROM model_credential_uses WHERE credential_id = $1 ORDER BY admitted_at, id",
      [saved.id],
    );
    expect(uses.rows.map((row) => row.status).sort()).toEqual(["completed", "failed"]);
  });

  it("returns summaries only, requires recent human auth for replacement, and isolates accounts", async () => {
    now = new Date(baseTime);
    const owner = await accountFixture();
    const other = await accountFixture();
    const onboarding = new OnboardingService(pool, {
      productScope: "pact",
      currentTermsVersion: "terms-v1",
      now: () => new Date(now),
    });
    const dispatcher = new CommandDispatcher({
      pool,
      clock: { now: () => new Date(now) },
      productScope: ProductScopeSchema.parse("pact"),
    });
    const server = buildServer(pool, false, undefined, { identity, onboarding, dispatcher, credentialVault: vault });

    const created = await server.inject({
      method: "POST",
      url: "/v1/model-connections",
      headers: headers(owner),
      payload: { provider: "openai", label: "Primary", credential: "sk-owner-secret-1234" },
    });
    expect(created.statusCode).toBe(200);
    const summary = created.json<{ id: string; suffix: string; version: number }>();
    expect(summary).toMatchObject({ suffix: "1234", version: 1 });
    expect(created.body).not.toContain("sk-owner-secret-1234");

    const listed = await server.inject({
      method: "GET",
      url: "/v1/model-connections",
      headers: headers(owner, false),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.body).not.toContain("credential_ciphertext");
    expect(listed.body).not.toContain("wrapped_data_key");
    expect(listed.body).not.toContain("sk-owner-secret-1234");

    const crossAccount = await server.inject({
      method: "POST",
      url: `/v1/model-connections/${summary.id}/revoke`,
      headers: headers(other),
    });
    expect(crossAccount.statusCode).toBe(404);

    now = new Date(baseTime.getTime() + 5 * 60_000 + 1);
    const stale = await server.inject({
      method: "PUT",
      url: `/v1/model-connections/${summary.id}`,
      headers: headers(owner),
      payload: { credential: "sk-replacement-5678", expectedVersion: 1 },
    });
    expect(stale.statusCode).toBe(403);
    expect(stale.json()).toMatchObject({ error: { code: "RECENT_AUTH_REQUIRED" } });

    now = new Date(baseTime);
    const replaced = await server.inject({
      method: "PUT",
      url: `/v1/model-connections/${summary.id}`,
      headers: headers(owner),
      payload: { credential: "sk-replacement-5678", label: "Rotated", expectedVersion: 1 },
    });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json()).toMatchObject({ label: "Rotated", suffix: "5678", version: 2 });
    await expect(
      resolver.withCredential(owner.accountId, summary.id, async (credential) =>
        Buffer.from(credential).toString("utf8"),
      ),
    ).resolves.toBe("sk-replacement-5678");
    await server.close();
  });

  it("rejects ciphertext substitution and lets only a pre-revocation provider call finish", async () => {
    now = new Date(baseTime);
    const first = await accountFixture();
    const second = await accountFixture();
    const firstCredential = await vault.save(first.accountId, {
      provider: "anthropic",
      label: "First",
      credential: "first-provider-secret",
    });
    const secondCredential = await vault.save(second.accountId, {
      provider: "anthropic",
      label: "Second",
      credential: "second-provider-secret",
    });
    await pool.query(
      `UPDATE model_connections AS target SET
         credential_ciphertext = source.credential_ciphertext,
         credential_nonce = source.credential_nonce,
         credential_auth_tag = source.credential_auth_tag,
         wrapped_data_key = source.wrapped_data_key,
         wrapping_algorithm = source.wrapping_algorithm,
         wrapping_key_id = source.wrapping_key_id
       FROM model_connections AS source WHERE target.id = $1 AND source.id = $2`,
      [firstCredential.id, secondCredential.id],
    );
    await expect(
      resolver.withCredential(first.accountId, firstCredential.id, async () => "must-not-run"),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });

    const admitted = await vault.save(first.accountId, {
      provider: "gemini",
      label: "Admitted",
      credential: "admitted-provider-secret",
    });
    const result = await resolver.withCredential(first.accountId, admitted.id, async (credential, admission) => {
      expect(Buffer.from(credential).toString("utf8")).toBe("admitted-provider-secret");
      expect(admission.revocationNotice).toContain("may complete");
      const revoked = await vault.revoke(first.accountId, admitted.id);
      expect(revoked.status).toBe("revoked");
      await expect(resolver.withCredential(first.accountId, admitted.id, async () => "blocked")).rejects.toMatchObject({
        code: "REVOKED",
      });
      return "provider-finished";
    });
    expect(result).toBe("provider-finished");

    const stored = await pool.query<{
      credential_ciphertext: Buffer | null;
      wrapped_data_key: string | null;
    }>("SELECT credential_ciphertext, wrapped_data_key FROM model_connections WHERE id = $1", [admitted.id]);
    expect(stored.rows[0]).toEqual({ credential_ciphertext: null, wrapped_data_key: null });
    const event = await pool.query<{ payload: Record<string, unknown> }>(
      "SELECT payload FROM outbox_events WHERE type = 'model-credential.revoked.v1' AND payload->>'credentialId' = $1",
      [admitted.id],
    );
    expect(JSON.stringify(event.rows[0]?.payload)).not.toContain("admitted-provider-secret");
    const use = await pool.query<{ status: string }>(
      "SELECT status FROM model_credential_uses WHERE credential_id = $1 ORDER BY admitted_at DESC LIMIT 1",
      [admitted.id],
    );
    expect(use.rows[0]?.status).toBe("completed");
  });
});
