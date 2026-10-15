import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { assertSafeMetadataUrl, OAuthError, OAuthService, verifyPkceS256 } from "@pact/oauth";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerOAuthRoutes } from "../../services/api/src/oauth-authority-routes.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const password = "A long test password 123!";
const issuer = "https://pact.example";
const mcpResource = `${issuer}/mcp`;
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let oauth: OAuthService;
let secretBox: AesGcmSecretBox;

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier, "utf8").digest("base64url") };
}

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "oauth");
  pool = createSchemaPool(connectionString, schema);
  const clock = { now: () => new Date("2026-09-20T18:00:00.000Z") };
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 7));
  identity = new IdentityService(pool, {
    connectionRefreshExpirations: (accountId) => oauth.refreshableGrantExpirations(accountId),
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.example"]),
    clock,
    digester: new TokenDigester(Buffer.alloc(32, 9)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  oauth = new OAuthService(pool, {
    productScope: "pact",
    issuer,
    mcpResource,
    humanResource: `${issuer}/native`,
    clock,
    metadataFetch: async () => ({ client_name: "Fixture MCP", redirect_uris: ["https://client.example/cb"] }),
  });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function verifiedAccount(email: string): Promise<string> {
  await identity.signup({ email, password, age18Declared: true, acceptedTermsVersion: "terms-v1" });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    `SELECT payload FROM outbox_events
     WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email'
     ORDER BY id DESC LIMIT 1`,
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("verification missing");
  await identity.verifyEmail(Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8"));
  return payload.accountId;
}

describe("PACT OAuth", () => {
  it("retains exactly configured migration resources, binds code/refresh to their original resource and redirects old consent to the owning origin", async () => {
    const legacyResource = "https://legacy.example/pact/mcp";
    const compatible = new OAuthService(pool, {
      productScope: "pact",
      issuer,
      mcpResource,
      mcpResourceAliases: [legacyResource],
      humanResource: `${issuer}/native`,
      clock: { now: () => new Date("2026-09-20T18:00:00Z") },
    });
    const client = await compatible.registerDynamic({
      displayName: "Synthetic ChatGPT migration",
      audience: "mcp",
      redirectUris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
    });
    const accountId = await verifiedAccount(`migration-${randomUUID()}@example.test`),
      challenge = pkce();
    const input = {
      clientId: client.clientId,
      redirectUri: client.redirectUris[0] ?? "",
      resource: legacyResource,
      scopes: "game:act world:read",
      subjectLabel: "Synthetic existing account",
      expectedAudience: "mcp" as const,
    };
    await expect(oauth.describeAuthorization(input)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    for (const resource of [legacyResource + "/", "https://foreign.example/mcp", `${issuer}/native`])
      await expect(compatible.describeAuthorization({ ...input, resource })).rejects.toMatchObject({
        code: "INVALID_REQUEST",
      });
    await expect(
      compatible.describeAuthorization({ ...input, redirectUri: input.redirectUri + "?changed=1" }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(compatible.describeAuthorization({ ...input, scopes: "account:delete" })).rejects.toMatchObject({
      code: "INVALID_SCOPE",
    });
    const app = Fastify();
    registerOAuthRoutes(app, compatible, identity);
    try {
      const q = new URLSearchParams({
        client_id: input.clientId,
        redirect_uri: input.redirectUri,
        resource: legacyResource,
        scope: input.scopes,
        response_type: "code",
        code_challenge: challenge.challenge,
        code_challenge_method: "S256",
        state: "synthetic_request_state_no_real_credentials",
        ui_locales: "en-GB",
      });
      const old = await app.inject({
        method: "GET",
        url: `/oauth/authorize?${q}`,
        headers: { host: "legacy.example" },
      });
      expect(old.statusCode).toBe(302);
      expect(old.headers["cache-control"]).toBe("no-store");
      const location = new URL(String(old.headers.location));
      expect(location.origin).toBe(issuer);
      expect(location.pathname).toBe("/oauth/authorize");
      for (const key of ["resource", "state", "client_id", "redirect_uri", "code_challenge", "scope"])
        expect(location.searchParams.get(key)).toBe(q.get(key));
      const canonicalQuery = new URLSearchParams(q);
      canonicalQuery.set("resource", mcpResource);
      const oldWithCurrentResource = await app.inject({
        method: "GET",
        url: `/oauth/authorize?${canonicalQuery}`,
        headers: { host: "legacy.example" },
      });
      expect(oldWithCurrentResource.statusCode).toBe(302);
      expect(new URL(String(oldWithCurrentResource.headers.location)).searchParams.get("resource")).toBe(mcpResource);
      expect(
        (await app.inject({ method: "GET", url: `/oauth/authorize?${q}`, headers: { host: "unconfigured.example" } }))
          .headers.location,
      ).toBeUndefined();
      const current = await app.inject({
        method: "GET",
        url: location.pathname + location.search,
        headers: { host: "pact.example" },
      });
      expect(current.statusCode).toBe(200);
      expect(current.body).toContain("Connect your kingdom");
      expect(current.body).toContain(legacyResource);
      expect(
        (await app.inject({ method: "GET", url: `/oauth/authorize?${q}`, headers: { host: "pact.example" } }))
          .statusCode,
      ).toBe(200);
    } finally {
      await app.close();
    }
    const auth = await compatible.beginAuthorization({
      ...input,
      accountId,
      codeChallenge: challenge.challenge,
      codeChallengeMethod: "S256",
    });
    const exchange = {
      clientId: client.clientId,
      code: auth.code,
      redirectUri: input.redirectUri,
      codeVerifier: challenge.verifier,
    };
    await expect(compatible.exchangeAuthorizationCode({ ...exchange, resource: mcpResource })).rejects.toMatchObject({
      code: "INVALID_GRANT",
    });
    await expect(
      compatible.exchangeAuthorizationCode({ ...exchange, resource: legacyResource, codeVerifier: pkce().verifier }),
    ).rejects.toMatchObject({ code: "INVALID_GRANT" });
    const tokens = await compatible.exchangeAuthorizationCode({ ...exchange, resource: legacyResource });
    const grant = await compatible.introspectAccessToken(tokens.accessToken);
    expect(grant).toMatchObject({ accountId, audience: "mcp", scopes: ["game:act", "world:read"] });
    expect((await pool.query("SELECT resource FROM oauth_grants WHERE id=$1", [grant?.grantId])).rows[0].resource).toBe(
      legacyResource,
    );
    await expect(compatible.exchangeAuthorizationCode({ ...exchange, resource: legacyResource })).rejects.toMatchObject(
      { code: "INVALID_GRANT" },
    );
    await expect(
      compatible.refresh({ clientId: client.clientId, refreshToken: tokens.refreshToken, resource: mcpResource }),
    ).rejects.toMatchObject({ code: "INVALID_GRANT" });
    const refreshed = await compatible.refresh({
      clientId: client.clientId,
      refreshToken: tokens.refreshToken,
      resource: legacyResource,
    });
    expect(await compatible.introspectAccessToken(refreshed.accessToken)).toMatchObject({ accountId });
    await expect(
      compatible.refresh({ clientId: client.clientId, refreshToken: tokens.refreshToken, resource: legacyResource }),
    ).rejects.toMatchObject({ code: "INVALID_GRANT" });
    expect(await compatible.introspectAccessToken(refreshed.accessToken)).toBeNull();
  });
  it("keeps expired-access connections visible only while an owned unused refresh remains valid", async () => {
    const email = `inventory-${randomUUID()}@example.test`,
      accountId = await verifiedAccount(email),
      other = await verifiedAccount(`other-${randomUUID()}@example.test`);
    const login = await identity.login({ email, password, ip: "192.0.2.17" });
    const grantId = randomUUID();
    await pool.query(
      `INSERT INTO oauth_grants(id,product_scope,account_id,client_id,token_family_id,scopes,expires_at) VALUES($1,'pact',$2,'fixture',$3,ARRAY['world:read'],'2026-09-20T17:00:00Z')`,
      [grantId, accountId, randomUUID()],
    );
    await pool.query(
      `INSERT INTO oauth_refresh_tokens(product_scope,grant_id,token_family_id,token_hash,expires_at) VALUES('pact',$1,$2,$3,'2026-09-21T18:00:00Z')`,
      [grantId, randomUUID(), randomUUID()],
    );
    expect(await oauth.refreshableGrantExpirations(other)).toEqual({});
    const inventory = await identity.connectionInventory(login.sessionToken);
    expect(inventory.grants).toMatchObject([{ id: grantId, refreshExpiresAt: new Date("2026-09-21T18:00:00Z") }]);
    expect(JSON.stringify(inventory)).not.toContain("token_hash");
    await pool.query("UPDATE oauth_refresh_tokens SET used_at=clock_timestamp() WHERE grant_id=$1", [grantId]);
    expect((await identity.connectionInventory(login.sessionToken)).grants).toEqual([]);
  });
  it("rejects wrong audience, redirect mismatch, refresh replay, revoked access, and private metadata", async () => {
    const accountId = await verifiedAccount(`oauth-${randomUUID()}@example.com`);
    const mcp = await oauth.registerPreregisteredClient({
      clientId: "mcp-fixture",
      displayName: "MCP Fixture",
      audience: "mcp",
      redirectUris: ["https://client.example/cb"],
    });
    await oauth.registerPreregisteredClient({
      clientId: "native-fixture",
      displayName: "Native Fixture",
      audience: "human",
      redirectUris: ["pact://oauth/callback"],
    });

    const challenge = pkce();
    await expect(
      oauth.beginAuthorization({
        clientId: mcp.clientId,
        redirectUri: "https://client.example/cb",
        scopes: "world:read",
        codeChallenge: challenge.challenge,
        codeChallengeMethod: "S256",
        resource: mcpResource,
        accountId,
        subjectLabel: "Draft North",
        expectedAudience: "human",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED_CLIENT" });

    await expect(
      oauth.beginAuthorization({
        clientId: mcp.clientId,
        redirectUri: "https://evil.example/cb",
        scopes: "world:read",
        codeChallenge: challenge.challenge,
        codeChallengeMethod: "S256",
        resource: mcpResource,
        accountId,
        subjectLabel: "Draft North",
        expectedAudience: "mcp",
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });

    const auth = await oauth.beginAuthorization({
      clientId: mcp.clientId,
      redirectUri: "https://client.example/cb",
      scopes: "world:read game:act",
      codeChallenge: challenge.challenge,
      codeChallengeMethod: "S256",
      resource: mcpResource,
      accountId,
      subjectLabel: "Draft North",
      expectedAudience: "mcp",
    });
    expect(auth.consent.clientName).toBe("MCP Fixture");
    expect(auth.consent.subjectLabel).toBe("Draft North");

    await expect(
      oauth.exchangeAuthorizationCode({
        clientId: "native-fixture",
        code: auth.code,
        redirectUri: "https://client.example/cb",
        codeVerifier: challenge.verifier,
        resource: mcpResource,
      }),
    ).rejects.toMatchObject({ code: "INVALID_GRANT" });

    const tokens = await oauth.exchangeAuthorizationCode({
      clientId: mcp.clientId,
      code: auth.code,
      redirectUri: "https://client.example/cb",
      codeVerifier: challenge.verifier,
      resource: mcpResource,
    });
    expect(tokens.audience).toBe("mcp");
    expect(verifyPkceS256(challenge.verifier, challenge.challenge)).toBe(true);

    const beforeEvidence = (await pool.query("SELECT count(*)::int n FROM oauth_refresh_tokens")).rows[0]?.n;
    const unused = await oauth.readRefreshEvidence(accountId, mcp.clientId, tokens.refreshToken);
    expect(unused).toMatchObject({ state: "unused", safeToRetry: false });
    expect(Object.keys(unused).sort()).toEqual(["meaning", "observedAt", "safeToRetry", "schemaVersion", "state"]);
    expect(await oauth.readRefreshEvidence(randomUUID(), mcp.clientId, tokens.refreshToken)).toMatchObject({
      state: "unknown",
      safeToRetry: false,
    });
    expect(await oauth.readRefreshEvidence(accountId, "other-client", tokens.refreshToken)).toMatchObject({
      state: "unknown",
    });
    expect(await oauth.readRefreshEvidence(accountId, mcp.clientId, "nonexistent-synthetic-token")).toMatchObject({
      state: "unknown",
    });
    expect((await pool.query("SELECT count(*)::int n FROM oauth_refresh_tokens")).rows[0]?.n).toBe(beforeEvidence);
    expect(JSON.stringify(unused)).not.toContain(tokens.refreshToken);
    const rotated = await oauth.refresh({ clientId: mcp.clientId, refreshToken: tokens.refreshToken });
    // Lost client acknowledgement would still leave an actual rotated server state.
    expect(await oauth.readRefreshEvidence(accountId, mcp.clientId, tokens.refreshToken)).toMatchObject({
      state: "rotated",
      safeToRetry: false,
    });
    expect(await oauth.readRefreshEvidence(accountId, mcp.clientId, rotated.refreshToken)).toMatchObject({
      state: "unused",
      safeToRetry: false,
    });

    expect(await oauth.introspectAccessToken(rotated.accessToken)).not.toBeNull();
    await expect(oauth.refresh({ clientId: mcp.clientId, refreshToken: tokens.refreshToken })).rejects.toMatchObject({
      code: "INVALID_GRANT",
    });
    expect(await oauth.readRefreshEvidence(accountId, mcp.clientId, rotated.refreshToken)).toMatchObject({
      state: "revoked",
      safeToRetry: false,
    });
    // Refresh reuse detection revokes the token family.
    expect(await oauth.introspectAccessToken(rotated.accessToken)).toBeNull();

    const challenge2 = pkce();
    const auth2 = await oauth.beginAuthorization({
      clientId: mcp.clientId,
      redirectUri: "https://client.example/cb",
      scopes: "world:read",
      codeChallenge: challenge2.challenge,
      codeChallengeMethod: "S256",
      resource: mcpResource,
      accountId,
      subjectLabel: "Draft North",
      expectedAudience: "mcp",
    });
    const active = await oauth.exchangeAuthorizationCode({
      clientId: mcp.clientId,
      code: auth2.code,
      redirectUri: "https://client.example/cb",
      codeVerifier: challenge2.verifier,
    });
    await oauth.revoke(active.accessToken);
    expect(await oauth.introspectAccessToken(active.accessToken)).toBeNull();
    await expect(oauth.refresh({ clientId: mcp.clientId, refreshToken: active.refreshToken })).rejects.toMatchObject({
      code: "INVALID_GRANT",
    });

    await expect(assertSafeMetadataUrl("http://127.0.0.1/meta.json")).rejects.toBeInstanceOf(OAuthError);
    await expect(assertSafeMetadataUrl("https://127.0.0.1/meta.json")).rejects.toBeInstanceOf(OAuthError);
    await expect(assertSafeMetadataUrl("https://localhost/meta.json")).rejects.toBeInstanceOf(OAuthError);

    expect(() => oauth.assertNotHumanOnly(["world:read"], "credential.read", "mcp")).toThrow(OAuthError);
    expect(() => oauth.assertNotHumanOnly(["game:act"], "authority.raise", "mcp")).toThrow(OAuthError);
    expect(() => oauth.assertNotHumanOnly(["game:act"], "approval.commit", "mcp")).toThrow(OAuthError);
  });

  it("registers metadata clients through the SSRF-safe fetcher and keeps human audience separate", async () => {
    const client = await oauth.registerFromMetadata("https://client.example/.well-known/oauth-client", "mcp");
    expect(client.displayName).toBe("Fixture MCP");
    const human = await oauth.registerDynamic({
      displayName: "Native Dyn",
      audience: "human",
      redirectUris: ["pact://oauth/callback"],
    });
    expect(human.audience).toBe("human");
    const accountId = await verifiedAccount(`oauth-human-${randomUUID()}@example.com`);
    const challenge = pkce();
    const auth = await oauth.beginAuthorization({
      clientId: human.clientId,
      redirectUri: "pact://oauth/callback",
      scopes: "world:read",
      codeChallenge: challenge.challenge,
      codeChallengeMethod: "S256",
      resource: `${issuer}/native`,
      accountId,
      subjectLabel: "Kingdom Draft",
      expectedAudience: "human",
    });
    const tokens = await oauth.exchangeAuthorizationCode({
      clientId: human.clientId,
      code: auth.code,
      redirectUri: "pact://oauth/callback",
      codeVerifier: challenge.verifier,
    });
    expect(tokens.audience).toBe("human");
    expect(() => oauth.assertNotHumanOnly(tokens.scope.split(" "), "authority.raise", "mcp")).toThrow(OAuthError);
  });
});

describe("proof-bound refresh recovery", () => {
  async function grant() {
    const accountId = await verifiedAccount(`recovery-${randomUUID()}@example.test`);
    const client = await oauth.registerDynamic({
      displayName: "Recovery fixture",
      audience: "mcp",
      redirectUris: ["https://client.example/cb"],
    });
    const challenge = pkce();
    const auth = await oauth.beginAuthorization({
      accountId,
      clientId: client.clientId,
      redirectUri: client.redirectUris[0] ?? "",
      resource: mcpResource,
      scopes: "world:read game:act",
      subjectLabel: "Fixture",
      expectedAudience: "mcp",
      codeChallenge: challenge.challenge,
      codeChallengeMethod: "S256",
    });
    const tokens = await oauth.exchangeAuthorizationCode({
      clientId: client.clientId,
      code: auth.code,
      redirectUri: client.redirectUris[0] ?? "",
      codeVerifier: challenge.verifier,
      resource: mcpResource,
    });
    return { accountId, client, tokens };
  }
  it("recovers exactly one committed rotation under concurrency without storing plaintext tokens", async () => {
    const { accountId, client, tokens } = await grant();
    const request = {
      clientId: client.clientId,
      refreshToken: tokens.refreshToken,
      resource: mcpResource,
      recoveryProof: randomBytes(32).toString("base64url"),
    };
    const [first, recovered] = await Promise.all([oauth.refresh(request), oauth.refresh(request)]);
    expect(recovered).toEqual(first);
    expect(await oauth.introspectAccessToken(recovered.accessToken)).toMatchObject({ accountId });
    const saved = JSON.stringify(
      (await pool.query("SELECT * FROM oauth_refresh_recoveries WHERE client_id=$1", [client.clientId])).rows,
    );
    for (const secret of [tokens.refreshToken, first.refreshToken, first.accessToken, request.recoveryProof])
      expect(saved).not.toContain(secret);
    const next = await oauth.refresh({
      clientId: client.clientId,
      refreshToken: first.refreshToken,
      resource: mcpResource,
      recoveryProof: randomBytes(32).toString("base64url"),
    });
    await expect(oauth.refresh(request)).rejects.toMatchObject({ code: "INVALID_GRANT" });
    expect(await oauth.introspectAccessToken(next.accessToken)).toMatchObject({ accountId });
  });
  it("never bypasses family revocation or legacy replay detection", async () => {
    const { client, tokens } = await grant();
    const request = {
      clientId: client.clientId,
      refreshToken: tokens.refreshToken,
      recoveryProof: randomBytes(32).toString("base64url"),
    };
    const next = await oauth.refresh(request);
    await oauth.revoke(next.accessToken);
    await expect(oauth.refresh(request)).rejects.toMatchObject({ code: "INVALID_GRANT" });
    const other = await grant();
    const rotated = await oauth.refresh({
      clientId: other.client.clientId,
      refreshToken: other.tokens.refreshToken,
      recoveryProof: randomBytes(32).toString("base64url"),
    });
    await expect(
      oauth.refresh({ clientId: other.client.clientId, refreshToken: other.tokens.refreshToken }),
    ).rejects.toMatchObject({ code: "INVALID_GRANT" });
    expect(await oauth.introspectAccessToken(rotated.accessToken)).toBeNull();
  });
  it("rejects wrong proof and expiry without exposing a result", async () => {
    const { client, tokens } = await grant();
    const request = {
      clientId: client.clientId,
      refreshToken: tokens.refreshToken,
      recoveryProof: randomBytes(32).toString("base64url"),
    };
    await oauth.refresh(request);
    await pool.query("UPDATE oauth_refresh_recoveries SET expires_at='2026-09-20T17:00:00Z' WHERE client_id=$1", [
      client.clientId,
    ]);
    await expect(oauth.refresh(request)).rejects.toMatchObject({ code: "INVALID_GRANT" });
    await expect(
      oauth.refresh({ ...request, recoveryProof: randomBytes(32).toString("base64url") }),
    ).rejects.toMatchObject({ code: "INVALID_GRANT" });
  });
});
