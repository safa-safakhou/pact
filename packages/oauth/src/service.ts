import { randomUUID } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import {
  assertExactRedirect,
  assertSafeMetadataUrl,
  fetchClientMetadata,
  hashToken,
  issueToken,
  OAuthError,
  type OAuthScope,
  parseScopes,
  verifyPkceS256,
} from "./crypto.js";

const ACCESS_TTL_MS = 15 * 60_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
const CODE_TTL_MS = 10 * 60_000;

export type OAuthAudience = "human" | "mcp";
export type ClientType = "preregistered" | "metadata" | "dynamic";

export interface OAuthClock {
  now(): Date;
}

export interface RegisteredClient {
  readonly clientId: string;
  readonly clientType: ClientType;
  readonly audience: OAuthAudience;
  readonly displayName: string;
  readonly redirectUris: readonly string[];
}

export interface ConsentView {
  readonly clientId: string;
  readonly clientName: string;
  readonly subjectLabel: string;
  readonly scopes: readonly OAuthScope[];
  readonly audience: OAuthAudience;
}

export interface TokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: "Bearer";
  readonly expiresIn: number;
  readonly scope: string;
  readonly audience: OAuthAudience;
}

interface ClientRow {
  client_id: string;
  client_type: ClientType;
  audience: OAuthAudience;
  display_name: string;
  redirect_uris: string[];
  revoked_at: Date | null;
}

export class OAuthService {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      issuer: string;
      mcpResource: string;
      humanResource: string;
      clock: OAuthClock;
      metadataFetch?: typeof fetchClientMetadata;
    },
  ) {}

  /** Owner connection inventory metadata only; never returns token hashes or credentials. */
  async refreshableGrantExpirations(accountId: string): Promise<Record<string, Date>> {
    const rows = (
      await this.pool.query<{ grant_id: string; expires_at: Date }>(
        `SELECT r.grant_id,max(r.expires_at) AS expires_at FROM oauth_refresh_tokens r
       JOIN oauth_grants g ON g.id=r.grant_id AND g.product_scope=r.product_scope
       WHERE r.product_scope=$1 AND g.account_id=$2 AND g.revoked_at IS NULL
       AND r.revoked_at IS NULL AND r.used_at IS NULL AND r.expires_at>$3 GROUP BY r.grant_id`,
        [this.options.productScope, accountId, this.options.clock.now()],
      )
    ).rows;
    return Object.fromEntries(rows.map((row) => [row.grant_id, row.expires_at]));
  }

  authorizationServerMetadata(): Record<string, unknown> {
    return {
      issuer: this.options.issuer,
      authorization_endpoint: `${this.options.issuer}/oauth/authorize`,
      token_endpoint: `${this.options.issuer}/oauth/token`,
      registration_endpoint: `${this.options.issuer}/oauth/register`,
      revocation_endpoint: `${this.options.issuer}/oauth/revoke`,
      code_challenge_methods_supported: ["S256"],
      response_types_supported: ["code"],
      authorization_response_iss_parameter_supported: true,
      grant_types_supported: ["authorization_code", "refresh_token"],
      scopes_supported: ["world:read", "messages:write", "game:act"],
      token_endpoint_auth_methods_supported: ["none"],
    };
  }

  protectedResourceMetadata(audience: OAuthAudience): Record<string, unknown> {
    const resource = audience === "mcp" ? this.options.mcpResource : this.options.humanResource;
    return {
      resource,
      authorization_servers: [this.options.issuer],
      scopes_supported: ["world:read", "messages:write", "game:act"],
      bearer_methods_supported: ["header"],
    };
  }

  async registerPreregisteredClient(input: {
    clientId: string;
    displayName: string;
    audience: OAuthAudience;
    redirectUris: readonly string[];
  }): Promise<RegisteredClient> {
    await this.pool.query(
      `INSERT INTO oauth_clients(product_scope, client_id, client_type, audience, display_name, redirect_uris)
       VALUES ($1, $2, 'preregistered', $3, $4, $5)
       ON CONFLICT(product_scope, client_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         audience = EXCLUDED.audience,
         redirect_uris = EXCLUDED.redirect_uris,
         revoked_at = NULL`,
      [this.options.productScope, input.clientId, input.audience, input.displayName, [...input.redirectUris]],
    );
    return {
      clientId: input.clientId,
      clientType: "preregistered",
      audience: input.audience,
      displayName: input.displayName,
      redirectUris: input.redirectUris,
    };
  }

  async registerFromMetadata(metadataUrl: string, audience: OAuthAudience): Promise<RegisteredClient> {
    const fetchMeta = this.options.metadataFetch ?? fetchClientMetadata;
    if (!this.options.metadataFetch) {
      await assertSafeMetadataUrl(metadataUrl);
    }
    const metadata = await fetchMeta(metadataUrl);
    const clientId = metadataUrl;
    await this.pool.query(
      `INSERT INTO oauth_clients(
         product_scope, client_id, client_type, audience, display_name, redirect_uris, metadata_url
       ) VALUES ($1, $2, 'metadata', $3, $4, $5, $6)
       ON CONFLICT(product_scope, client_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         redirect_uris = EXCLUDED.redirect_uris,
         audience = EXCLUDED.audience,
         revoked_at = NULL`,
      [this.options.productScope, clientId, audience, metadata.client_name, metadata.redirect_uris, metadataUrl],
    );
    return {
      clientId,
      clientType: "metadata",
      audience,
      displayName: metadata.client_name,
      redirectUris: metadata.redirect_uris,
    };
  }

  async registerDynamic(input: {
    displayName: string;
    audience: OAuthAudience;
    redirectUris: readonly string[];
  }): Promise<RegisteredClient> {
    const clientId = `dyn_${randomUUID()}`;
    await this.pool.query(
      `INSERT INTO oauth_clients(product_scope, client_id, client_type, audience, display_name, redirect_uris)
       VALUES ($1, $2, 'dynamic', $3, $4, $5)`,
      [this.options.productScope, clientId, input.audience, input.displayName, [...input.redirectUris]],
    );
    return {
      clientId,
      clientType: "dynamic",
      audience: input.audience,
      displayName: input.displayName,
      redirectUris: input.redirectUris,
    };
  }

  async beginAuthorization(input: {
    clientId: string;
    redirectUri: string;
    scopes: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    resource: string;
    accountId: string;
    subjectLabel: string;
    expectedAudience: OAuthAudience;
  }): Promise<{ code: string; consent: ConsentView }> {
    if (input.codeChallengeMethod !== "S256" || input.codeChallenge.length < 43) {
      throw new OAuthError("INVALID_REQUEST");
    }
    const consent = await this.describeAuthorization(input);
    const code = issueToken();
    const now = this.options.clock.now();
    await this.pool.query(
      `INSERT INTO oauth_authorization_codes(
         product_scope, code_hash, client_id, account_id, redirect_uri, scopes,
         code_challenge, code_challenge_method, resource, subject_label, expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'S256',$8,$9,$10)`,
      [
        this.options.productScope,
        code.hash,
        consent.clientId,
        input.accountId,
        input.redirectUri,
        consent.scopes,
        input.codeChallenge,
        input.resource,
        input.subjectLabel,
        new Date(now.getTime() + CODE_TTL_MS),
      ],
    );
    return {
      code: code.raw,
      consent: {
        ...consent,
      },
    };
  }

  async describeAuthorization(input: {
    clientId: string;
    redirectUri: string;
    scopes: string;
    resource: string;
    subjectLabel: string;
    expectedAudience: OAuthAudience;
  }): Promise<ConsentView> {
    const scopes = parseScopes(input.scopes);
    const client = await this.requireClient(input.clientId);
    if (client.audience !== input.expectedAudience) throw new OAuthError("UNAUTHORIZED_CLIENT");
    assertExactRedirect(client.redirect_uris, input.redirectUri);
    const expectedResource = client.audience === "mcp" ? this.options.mcpResource : this.options.humanResource;
    if (input.resource !== expectedResource) throw new OAuthError("INVALID_REQUEST");
    return {
      clientId: client.client_id,
      clientName: client.display_name,
      subjectLabel: input.subjectLabel,
      scopes,
      audience: client.audience,
    };
  }

  async exchangeAuthorizationCode(input: {
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
    resource?: string;
  }): Promise<TokenResponse> {
    const client = await this.requireClient(input.clientId);
    return withTransaction(this.pool, async (db) => {
      const codeHash = hashToken(input.code);
      const row = await db.query<{
        id: string;
        client_id: string;
        redirect_uri: string;
        scopes: string[];
        code_challenge: string;
        resource: string;
        account_id: string;
        subject_label: string;
        expires_at: Date;
        used_at: Date | null;
      }>(`SELECT * FROM oauth_authorization_codes WHERE product_scope = $1 AND code_hash = $2 FOR UPDATE`, [
        this.options.productScope,
        codeHash,
      ]);
      const auth = row.rows[0];
      if (!auth || auth.used_at || auth.expires_at <= this.options.clock.now()) {
        throw new OAuthError("INVALID_GRANT");
      }
      if (auth.client_id !== client.client_id) throw new OAuthError("INVALID_GRANT");
      if (auth.redirect_uri !== input.redirectUri) throw new OAuthError("INVALID_GRANT");
      if (!verifyPkceS256(input.codeVerifier, auth.code_challenge)) throw new OAuthError("INVALID_GRANT");
      if (input.resource && input.resource !== auth.resource) throw new OAuthError("INVALID_GRANT");
      await db.query("UPDATE oauth_authorization_codes SET used_at = $2 WHERE id = $1", [
        auth.id,
        this.options.clock.now(),
      ]);
      return this.issueTokens(db, {
        accountId: auth.account_id,
        clientId: client.client_id,
        audience: client.audience,
        scopes: auth.scopes,
        resource: auth.resource,
        subjectLabel: auth.subject_label,
      });
    });
  }

  async refresh(input: { clientId: string; refreshToken: string; resource?: string }): Promise<TokenResponse> {
    const client = await this.requireClient(input.clientId);
    const presentedHash = hashToken(input.refreshToken);
    const outcome = await withTransaction(this.pool, async (db) => {
      const token = await db.query<{
        id: string;
        grant_id: string;
        token_family_id: string;
        expires_at: Date;
        used_at: Date | null;
        revoked_at: Date | null;
      }>(`SELECT * FROM oauth_refresh_tokens WHERE product_scope = $1 AND token_hash = $2 FOR UPDATE`, [
        this.options.productScope,
        presentedHash,
      ]);
      const refresh = token.rows[0];
      if (!refresh) return { type: "invalid" as const };
      if (refresh.used_at || refresh.revoked_at) {
        await this.revokeFamily(db, refresh.token_family_id);
        return { type: "reuse" as const };
      }
      if (refresh.expires_at <= this.options.clock.now()) return { type: "invalid" as const };
      const grant = await db.query<{
        id: string;
        account_id: string;
        scopes: string[];
        audience: OAuthAudience;
        resource: string;
        subject_label: string;
        revoked_at: Date | null;
        client_id: string;
      }>(`SELECT * FROM oauth_grants WHERE id = $1 FOR UPDATE`, [refresh.grant_id]);
      const grantRow = grant.rows[0];
      if (!grantRow || grantRow.revoked_at || grantRow.client_id !== client.client_id) {
        return { type: "invalid" as const };
      }
      if (input.resource && input.resource !== grantRow.resource) return { type: "invalid" as const };
      await db.query("UPDATE oauth_refresh_tokens SET used_at = $2 WHERE id = $1", [
        refresh.id,
        this.options.clock.now(),
      ]);
      const tokens = await this.issueTokens(db, {
        accountId: grantRow.account_id,
        clientId: client.client_id,
        audience: grantRow.audience,
        scopes: grantRow.scopes,
        resource: grantRow.resource,
        subjectLabel: grantRow.subject_label,
        tokenFamilyId: refresh.token_family_id,
        grantId: grantRow.id,
        parentRefreshHash: presentedHash,
      });
      return { type: "ok" as const, tokens };
    });
    if (outcome.type === "ok") return outcome.tokens;
    throw new OAuthError("INVALID_GRANT");
  }

  async revoke(accessOrRefreshToken: string): Promise<void> {
    const hash = hashToken(accessOrRefreshToken);
    await withTransaction(this.pool, async (db) => {
      const grant = await db.query<{ id: string; token_family_id: string }>(
        `SELECT id, token_family_id FROM oauth_grants
         WHERE product_scope = $1 AND access_token_hash = $2 AND revoked_at IS NULL`,
        [this.options.productScope, hash],
      );
      if (grant.rows[0]) {
        await this.revokeFamily(db, grant.rows[0].token_family_id);
        return;
      }
      const refresh = await db.query<{ token_family_id: string }>(
        `SELECT token_family_id FROM oauth_refresh_tokens
         WHERE product_scope = $1 AND token_hash = $2`,
        [this.options.productScope, hash],
      );
      if (refresh.rows[0]) await this.revokeFamily(db, refresh.rows[0].token_family_id);
    });
  }

  async introspectAccessToken(accessToken: string): Promise<{
    grantId: string;
    accountId: string;
    clientId: string;
    audience: OAuthAudience;
    scopes: string[];
    subjectLabel: string;
  } | null> {
    const result = await this.pool.query<{
      id: string;
      account_id: string;
      client_id: string;
      audience: OAuthAudience;
      scopes: string[];
      subject_label: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, account_id, client_id, audience, scopes, subject_label, expires_at, revoked_at
       FROM oauth_grants WHERE product_scope = $1 AND access_token_hash = $2`,
      [this.options.productScope, hashToken(accessToken)],
    );
    const row = result.rows[0];
    if (!row || row.revoked_at || row.expires_at <= this.options.clock.now()) return null;
    return {
      grantId: row.id,
      accountId: row.account_id,
      clientId: row.client_id,
      audience: row.audience,
      scopes: row.scopes,
      subjectLabel: row.subject_label,
    };
  }

  assertNotHumanOnly(scopes: readonly string[], operation: string, audience: OAuthAudience): void {
    const humanOnly = [
      "approval.commit",
      "credential.read",
      "authority.raise",
      "checkout",
      "account.delete",
      "account.export",
    ];
    if (audience === "mcp" && humanOnly.includes(operation)) throw new OAuthError("FORBIDDEN");
    if (operation === "credential.read") throw new OAuthError("FORBIDDEN");
    void scopes;
  }

  private async requireClient(clientId: string): Promise<ClientRow> {
    const result = await this.pool.query<ClientRow>(
      `SELECT client_id, client_type, audience, display_name, redirect_uris, revoked_at
       FROM oauth_clients WHERE product_scope = $1 AND client_id = $2`,
      [this.options.productScope, clientId],
    );
    const client = result.rows[0];
    if (!client || client.revoked_at) throw new OAuthError("INVALID_CLIENT");
    return client;
  }

  private async issueTokens(
    db: PoolClient,
    input: {
      accountId: string;
      clientId: string;
      audience: OAuthAudience;
      scopes: string[];
      resource: string;
      subjectLabel: string;
      tokenFamilyId?: string;
      grantId?: string;
      parentRefreshHash?: string;
    },
  ): Promise<TokenResponse> {
    const now = this.options.clock.now();
    const access = issueToken();
    const refresh = issueToken();
    const familyId = input.tokenFamilyId ?? randomUUID();
    const accessExpires = new Date(now.getTime() + ACCESS_TTL_MS);
    const refreshExpires = new Date(now.getTime() + REFRESH_TTL_MS);
    let grantId = input.grantId;
    if (grantId) {
      await db.query(
        `UPDATE oauth_grants SET access_token_hash = $2, expires_at = $3, scopes = $4
         WHERE id = $1`,
        [grantId, access.hash, accessExpires, input.scopes],
      );
    } else {
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO oauth_grants(
           product_scope, account_id, client_id, token_family_id, scopes, expires_at,
           audience, resource, subject_label, access_token_hash
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          this.options.productScope,
          input.accountId,
          input.clientId,
          familyId,
          input.scopes,
          accessExpires,
          input.audience,
          input.resource,
          input.subjectLabel,
          access.hash,
        ],
      );
      grantId = inserted.rows[0]?.id;
      if (!grantId) throw new Error("grant insert failed");
    }
    await db.query(
      `INSERT INTO oauth_refresh_tokens(
         product_scope, grant_id, token_family_id, token_hash, parent_token_hash, expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [this.options.productScope, grantId, familyId, refresh.hash, input.parentRefreshHash ?? null, refreshExpires],
    );
    return {
      accessToken: access.raw,
      refreshToken: refresh.raw,
      tokenType: "Bearer",
      expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
      scope: input.scopes.join(" "),
      audience: input.audience,
    };
  }

  private async revokeFamily(db: PoolClient, familyId: string): Promise<void> {
    const now = this.options.clock.now();
    await db.query(
      `UPDATE oauth_grants SET revoked_at = $2 WHERE product_scope = $1 AND token_family_id = $3 AND revoked_at IS NULL`,
      [this.options.productScope, now, familyId],
    );
    await db.query(
      `UPDATE oauth_refresh_tokens SET revoked_at = $2
       WHERE product_scope = $1 AND token_family_id = $3 AND revoked_at IS NULL`,
      [this.options.productScope, now, familyId],
    );
  }
}
