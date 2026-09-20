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
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

    const tokens = await oauth.exchangeAuthorizationCode({
      clientId: mcp.clientId,
      code: auth.code,
      redirectUri: "https://client.example/cb",
      codeVerifier: challenge.verifier,
      resource: mcpResource,
    });
    expect(tokens.audience).toBe("mcp");
    expect(verifyPkceS256(challenge.verifier, challenge.challenge)).toBe(true);

    const rotated = await oauth.refresh({ clientId: mcp.clientId, refreshToken: tokens.refreshToken });
    expect(await oauth.introspectAccessToken(rotated.accessToken)).not.toBeNull();
    await expect(oauth.refresh({ clientId: mcp.clientId, refreshToken: tokens.refreshToken })).rejects.toMatchObject({
      code: "INVALID_GRANT",
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
