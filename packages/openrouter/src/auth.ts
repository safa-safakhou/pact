import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool } from "pg";

const FLOW_TTL_MS = 10 * 60_000;

export class OpenRouterAuthError extends Error {
  constructor(
    readonly code:
      | "INVALID_STATE"
      | "EXPIRED"
      | "REPLAY"
      | "SESSION_MISMATCH"
      | "CALLBACK_MISMATCH"
      | "EXCHANGE_FAILED"
      | "FORBIDDEN",
  ) {
    super(code);
    this.name = "OpenRouterAuthError";
  }
}

export type OpenRouterFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface OpenRouterAuthOptions {
  readonly productScope: string;
  readonly clock: { now(): Date };
  readonly authorizeBaseUrl?: string;
  readonly tokenUrl?: string;
  readonly fetch?: OpenRouterFetch;
}

function hashState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier, "utf8").digest("base64url");
  return { verifier, challenge };
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class OpenRouterAuthService {
  private readonly authorizeBaseUrl: string;
  private readonly tokenUrl: string;
  private readonly fetchImpl: OpenRouterFetch;

  constructor(
    private readonly pool: Pool,
    private readonly options: OpenRouterAuthOptions,
  ) {
    this.authorizeBaseUrl = options.authorizeBaseUrl ?? "https://openrouter.ai/auth";
    this.tokenUrl = options.tokenUrl ?? "https://openrouter.ai/api/v1/auth/keys";
    this.fetchImpl = options.fetch ?? fetch;
  }

  async begin(input: {
    accountId: string;
    sessionId: string;
    callbackUrl: string;
  }): Promise<{ authorizeUrl: string; state: string; expiresAt: Date }> {
    const state = randomBytes(32).toString("base64url");
    const { verifier, challenge } = pkcePair();
    const expiresAt = new Date(this.options.clock.now().getTime() + FLOW_TTL_MS);
    await this.pool.query(
      `INSERT INTO openrouter_oauth_flows(
         product_scope, account_id, session_id, state_hash, code_verifier, code_challenge, callback_url, expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        this.options.productScope,
        input.accountId,
        input.sessionId,
        hashState(state),
        verifier,
        challenge,
        input.callbackUrl,
        expiresAt,
      ],
    );
    const url = new URL(this.authorizeBaseUrl);
    url.searchParams.set("callback_url", input.callbackUrl);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    return { authorizeUrl: url.toString(), state, expiresAt };
  }

  async complete(input: {
    accountId: string;
    sessionId: string;
    state: string;
    code: string;
    callbackUrl: string;
  }): Promise<{ apiKey: string; label: string }> {
    // Claim the single-use flow inside the transaction; exchange the code outside it.
    const claimed = await withTransaction(this.pool, async (client) => {
      const loaded = await client.query<{
        flow_id: string;
        account_id: string;
        session_id: string;
        code_verifier: string;
        callback_url: string;
        expires_at: Date;
        consumed_at: Date | null;
      }>(
        `SELECT flow_id, account_id, session_id, code_verifier, callback_url, expires_at, consumed_at
         FROM openrouter_oauth_flows WHERE product_scope = $1 AND state_hash = $2 FOR UPDATE`,
        [this.options.productScope, hashState(input.state)],
      );
      const row = loaded.rows[0];
      if (!row) throw new OpenRouterAuthError("INVALID_STATE");
      if (row.account_id !== input.accountId || row.session_id !== input.sessionId) {
        throw new OpenRouterAuthError("SESSION_MISMATCH");
      }
      if (row.consumed_at) throw new OpenRouterAuthError("REPLAY");
      if (row.expires_at <= this.options.clock.now()) throw new OpenRouterAuthError("EXPIRED");
      if (!safeEqual(row.callback_url, input.callbackUrl)) throw new OpenRouterAuthError("CALLBACK_MISMATCH");

      await client.query(`UPDATE openrouter_oauth_flows SET consumed_at = $2 WHERE flow_id = $1`, [
        row.flow_id,
        this.options.clock.now(),
      ]);
      return { codeVerifier: row.code_verifier };
    });

    let response: Response;
    try {
      response = await this.fetchImpl(this.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: input.code,
          code_verifier: claimed.codeVerifier,
          code_challenge_method: "S256",
        }),
      });
    } catch {
      throw new OpenRouterAuthError("EXCHANGE_FAILED");
    }
    if (!response.ok) throw new OpenRouterAuthError("EXCHANGE_FAILED");
    const body = (await response.json()) as { key?: string; label?: string };
    if (!body.key) throw new OpenRouterAuthError("EXCHANGE_FAILED");
    return { apiKey: body.key, label: body.label ?? "OpenRouter" };
  }
}
