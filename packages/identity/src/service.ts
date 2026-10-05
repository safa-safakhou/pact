import { randomBytes, randomUUID } from "node:crypto";
import { appendOutbox, withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import {
  encodeBase32,
  hashPassword,
  normalizeEmail,
  type TokenDigester,
  validatePassword,
  verifyPassword,
  verifyTotp,
} from "./crypto.js";
import type {
  CompromisedPasswordChecker,
  HumanSession,
  IdentityClock,
  SecretBox,
  SensitiveAction,
  SessionTokens,
} from "./types.js";
import { IdentityError } from "./types.js";

const minutes = (value: number): number => value * 60_000;
const days = (value: number): number => value * 24 * 60 * 60_000;

export interface IdentityServiceOptions {
  readonly guestPlayEnabled?: boolean;
  readonly connectionRefreshExpirations?: (accountId: string) => Promise<Record<string, Date>>;
  readonly productScope: string;
  readonly currentTermsVersion: string;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly clock: IdentityClock;
  readonly digester: TokenDigester;
  readonly secretBox: SecretBox;
  readonly compromisedPasswords: CompromisedPasswordChecker;
}

interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  terms_version: string | null;
  role: "player" | "staff";
  totp_secret_ciphertext: string | null;
}

interface SessionRow {
  id: string;
  account_id: string;
  audience: "human" | "agent" | "service";
  csrf_token_hash: string | null;
  authenticated_at: Date;
  idle_expires_at: Date;
  expires_at: Date;
}

export class IdentityService {
  constructor(
    private readonly pool: Pool,
    private readonly options: IdentityServiceOptions,
  ) {}

  get guestPlayEnabled(): boolean {
    return this.options.guestPlayEnabled === true;
  }

  async joinGuest(entryKey: string): Promise<SessionTokens> {
    if (!this.guestPlayEnabled || !/^[0-9a-f-]{36}$/i.test(entryKey)) throw new IdentityError("FORBIDDEN");
    const now = this.options.clock.now();
    return withTransaction(this.pool, async (client) => {
      const hash = this.options.digester.digest(`guest:${entryKey}`);
      const row = (
        await client.query<{ id: string; status: string }>(
          `INSERT INTO accounts(product_scope,email,password_hash,is_guest,guest_entry_hash,terms_version)
         VALUES($1,NULL,'guest-no-password',true,$2,$3)
         ON CONFLICT(product_scope,guest_entry_hash) WHERE guest_entry_hash IS NOT NULL
         DO UPDATE SET guest_entry_hash=EXCLUDED.guest_entry_hash RETURNING id,status`,
          [this.options.productScope, hash, this.options.currentTermsVersion],
        )
      ).rows[0];
      if (row?.status !== "active") throw new IdentityError("FORBIDDEN");
      const next = this.newSessionTokens(row.id, now);
      await this.insertSession(client, next, "Guest play", now);
      return next.tokens;
    });
  }

  async isGuest(accountId: string): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT id FROM accounts WHERE product_scope=$1 AND id=$2 AND is_guest AND status='active'",
      [this.options.productScope, accountId],
    );
    return result.rowCount === 1;
  }

  /** Same-browser bootstrap: a deterministic per-session CSRF value survives tab/restart. */
  async guestSession(sessionToken: string): Promise<{ accountId: string; csrfToken: string }> {
    const session = await this.authenticate(sessionToken);
    if (!this.guestPlayEnabled || !(await this.isGuest(session.accountId))) throw new IdentityError("FORBIDDEN");
    const csrfToken = this.options.digester.digest(`guest-csrf:${sessionToken}`);
    await this.pool.query("UPDATE sessions SET csrf_token_hash=$2 WHERE id=$1", [
      session.sessionId,
      this.options.digester.digest(csrfToken),
    ]);
    return { accountId: session.accountId, csrfToken };
  }

  async signup(input: {
    email: string;
    password: string;
    age18Declared: boolean;
    acceptedTermsVersion: string;
    requestId?: string;
  }): Promise<{ accepted: true }> {
    let email: string;
    try {
      email = normalizeEmail(input.email);
      validatePassword(input.password);
    } catch {
      throw new IdentityError("INVALID_INPUT");
    }
    if (!input.age18Declared || input.acceptedTermsVersion !== this.options.currentTermsVersion) {
      throw new IdentityError("TERMS_REQUIRED");
    }
    if (await this.options.compromisedPasswords.isCompromised(input.password)) {
      throw new IdentityError("PASSWORD_REJECTED");
    }
    const passwordHash = await hashPassword(input.password);
    const now = this.options.clock.now();
    await withTransaction(this.pool, async (client) => {
      const permitted = await this.consumeLimit(client, "verification_email", email, 3, 60 * 60_000, now, false);
      if (!permitted) return;
      const account = await client.query<{ id: string }>(
        `INSERT INTO accounts(
           product_scope, email, password_hash, terms_version, terms_accepted_at, age_18_declared_at
         ) VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT(product_scope, email) DO NOTHING RETURNING id`,
        [this.options.productScope, email, passwordHash, input.acceptedTermsVersion, now],
      );
      const accountId = account.rows[0]?.id;
      if (!accountId) return;
      const token = this.options.digester.issue();
      await client.query(
        `INSERT INTO email_verification_tokens(product_scope, account_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [this.options.productScope, accountId, token.hash, new Date(now.getTime() + days(1))],
      );
      await this.securityEvent(client, accountId, "account.signup", input.requestId);
      await this.securityEmail(client, accountId, "verify_email", token.raw);
    });
    return { accepted: true };
  }

  async verifyEmail(rawToken: string, requestId?: string): Promise<{ accountId: string }> {
    const now = this.options.clock.now();
    const tokenHash = this.options.digester.digest(rawToken);
    return withTransaction(this.pool, async (client) => {
      const token = await client.query<{ id: string; account_id: string; expires_at: Date; used_at: Date | null }>(
        `SELECT id, account_id, expires_at, used_at FROM email_verification_tokens
         WHERE product_scope = $1 AND token_hash = $2 FOR UPDATE`,
        [this.options.productScope, tokenHash],
      );
      const row = token.rows[0];
      if (!row || row.used_at || row.expires_at <= now) throw new IdentityError("INVALID_TOKEN");
      await client.query("UPDATE email_verification_tokens SET used_at = $2 WHERE id = $1 AND used_at IS NULL", [
        row.id,
        now,
      ]);
      await client.query(
        "UPDATE accounts SET email_verified_at = COALESCE(email_verified_at, $2), updated_at = $2 WHERE id = $1",
        [row.account_id, now],
      );
      await this.securityEvent(client, row.account_id, "account.email_verified", requestId);
      return { accountId: row.account_id };
    });
  }

  async login(input: {
    email: string;
    password: string;
    ip: string;
    label?: string;
    mfaCode?: string;
    requestId?: string;
  }): Promise<SessionTokens> {
    let email: string;
    try {
      email = normalizeEmail(input.email);
    } catch {
      email = "invalid@example.invalid";
    }
    const now = this.options.clock.now();
    const accountLimit = await this.limitReached("login_account", email, 5, minutes(15), now);
    const ipLimit = await this.limitReached("login_ip", input.ip, 30, minutes(15), now);
    if (accountLimit || ipLimit) throw new IdentityError("RATE_LIMITED");
    const accountResult = await this.pool.query<AccountRow>(
      `SELECT id, email, password_hash, email_verified_at, terms_version, role, totp_secret_ciphertext
       FROM accounts WHERE product_scope = $1 AND email = $2 AND status = 'active'`,
      [this.options.productScope, email],
    );
    const account = accountResult.rows[0];
    const passwordMatches = account
      ? await verifyPassword(account.password_hash, input.password)
      : await this.equalizeMissingPassword(input.password);
    if (!account || !passwordMatches || !account.email_verified_at) {
      await this.recordLoginFailure(email, input.ip, now);
      throw new IdentityError("INVALID_CREDENTIALS");
    }
    await withTransaction(this.pool, async (client) => this.requireMfa(client, account, input.mfaCode, now));
    return this.createSession(account.id, input.label, input.requestId, Boolean(account.totp_secret_ciphertext));
  }

  async authenticate(sessionToken: string, touch = true): Promise<HumanSession> {
    const now = this.options.clock.now();
    const tokenHash = this.options.digester.digest(sessionToken);
    const result = await this.pool.query<SessionRow>(
      `SELECT id, account_id, audience, csrf_token_hash, authenticated_at, idle_expires_at, expires_at
       FROM sessions WHERE product_scope = $1 AND token_hash = $2 AND revoked_at IS NULL
         AND idle_expires_at > $3 AND expires_at > $3`,
      [this.options.productScope, tokenHash, now],
    );
    const row = result.rows[0];
    if (row?.audience !== "human") throw new IdentityError("FORBIDDEN");
    const nextIdle = new Date(Math.min(row.expires_at.getTime(), now.getTime() + days(7)));
    if (touch) {
      await this.pool.query("UPDATE sessions SET last_seen_at = $2, idle_expires_at = $3 WHERE id = $1", [
        row.id,
        now,
        nextIdle,
      ]);
    }
    return {
      sessionId: row.id,
      accountId: row.account_id,
      audience: "human",
      authenticatedAt: row.authenticated_at,
      idleExpiresAt: nextIdle,
      absoluteExpiresAt: row.expires_at,
    };
  }

  async authorizeCookieWrite(sessionToken: string, csrfToken: string, origin: string): Promise<HumanSession> {
    if (!this.options.allowedOrigins.has(origin)) throw new IdentityError("FORBIDDEN");
    const session = await this.authenticate(sessionToken);
    const result = await this.pool.query<{ csrf_token_hash: string | null }>(
      "SELECT csrf_token_hash FROM sessions WHERE id = $1",
      [session.sessionId],
    );
    if (result.rows[0]?.csrf_token_hash !== this.options.digester.digest(csrfToken)) {
      throw new IdentityError("FORBIDDEN");
    }
    return session;
  }

  async requireRecentHumanSession(sessionToken: string, _action: SensitiveAction): Promise<HumanSession> {
    const session = await this.authenticate(sessionToken);
    if (
      !(this.guestPlayEnabled && (await this.isGuest(session.accountId))) &&
      this.options.clock.now().getTime() - session.authenticatedAt.getTime() > minutes(5)
    ) {
      throw new IdentityError("RECENT_AUTH_REQUIRED");
    }
    return session;
  }

  async requireStaffSession(sessionToken: string): Promise<HumanSession> {
    const session = await this.authenticate(sessionToken);
    const row = await this.pool.query(
      `SELECT s.id FROM sessions s JOIN accounts a ON a.id=s.account_id AND a.product_scope=s.product_scope
       WHERE s.product_scope=$1 AND s.id=$2 AND a.role='staff' AND a.status='active'
       AND a.totp_secret_ciphertext IS NOT NULL AND s.mfa_authenticated_at>=$3`,
      [this.options.productScope, session.sessionId, new Date(this.options.clock.now().getTime() - minutes(5))],
    );
    if (!row.rowCount) throw new IdentityError("FORBIDDEN");
    return session;
  }

  async reauthenticate(input: {
    sessionToken: string;
    password: string;
    mfaCode?: string;
    requestId?: string;
  }): Promise<SessionTokens> {
    const session = await this.authenticate(input.sessionToken, false);
    const accountResult = await this.pool.query<AccountRow>(
      `SELECT id, email, password_hash, email_verified_at, terms_version, role, totp_secret_ciphertext
       FROM accounts WHERE id = $1`,
      [session.accountId],
    );
    const account = accountResult.rows[0];
    if (!account || !(await verifyPassword(account.password_hash, input.password))) {
      throw new IdentityError("INVALID_CREDENTIALS");
    }
    const now = this.options.clock.now();
    const next = this.newSessionTokens(account.id, now);
    await withTransaction(this.pool, async (client) => {
      await this.requireMfa(client, account, input.mfaCode, now);
      await client.query("UPDATE sessions SET revoked_at = $2 WHERE id = $1", [session.sessionId, now]);
      await this.insertSession(client, next, undefined, now, Boolean(account.totp_secret_ciphertext));
      await this.securityEvent(client, account.id, "session.reauthenticated", input.requestId);
    });
    return next.tokens;
  }

  async requestPasswordReset(emailInput: string, requestId?: string): Promise<{ accepted: true }> {
    let email: string;
    try {
      email = normalizeEmail(emailInput);
    } catch {
      email = "invalid@example.invalid";
    }
    const now = this.options.clock.now();
    await withTransaction(this.pool, async (client) => {
      const permitted = await this.consumeLimit(client, "reset_email", email, 3, 60 * 60_000, now, false);
      if (!permitted) return;
      const result = await client.query<{ id: string }>(
        "SELECT id FROM accounts WHERE product_scope = $1 AND email = $2 AND email_verified_at IS NOT NULL",
        [this.options.productScope, email],
      );
      const accountId = result.rows[0]?.id;
      if (!accountId) return;
      const token = this.options.digester.issue();
      await client.query(
        `INSERT INTO password_reset_tokens(product_scope, account_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [this.options.productScope, accountId, token.hash, new Date(now.getTime() + minutes(15))],
      );
      await this.securityEvent(client, accountId, "password.reset_requested", requestId);
      await this.securityEmail(client, accountId, "reset_password", token.raw);
    });
    return { accepted: true };
  }

  async resetPassword(rawToken: string, newPassword: string, requestId?: string): Promise<void> {
    await this.assertNewPassword(newPassword);
    const passwordHash = await hashPassword(newPassword);
    const tokenHash = this.options.digester.digest(rawToken);
    const now = this.options.clock.now();
    await withTransaction(this.pool, async (client) => {
      const result = await client.query<{ id: string; account_id: string; expires_at: Date; used_at: Date | null }>(
        `SELECT id, account_id, expires_at, used_at FROM password_reset_tokens
         WHERE product_scope = $1 AND token_hash = $2 FOR UPDATE`,
        [this.options.productScope, tokenHash],
      );
      const token = result.rows[0];
      if (!token || token.used_at || token.expires_at <= now) throw new IdentityError("INVALID_TOKEN");
      await client.query("UPDATE password_reset_tokens SET used_at = $2 WHERE id = $1", [token.id, now]);
      await client.query(
        "UPDATE accounts SET password_hash = $2, password_changed_at = $3, updated_at = $3 WHERE id = $1",
        [token.account_id, passwordHash, now],
      );
      await this.revokeAccess(client, token.account_id, now, "password_reset", requestId);
      await this.securityEmail(client, token.account_id, "password_changed");
    });
  }

  async signOutEverywhere(sessionToken: string, requestId?: string): Promise<void> {
    const session = await this.requireRecentHumanSession(sessionToken, "password.change");
    const now = this.options.clock.now();
    await withTransaction(this.pool, (client) =>
      this.revokeAccess(client, session.accountId, now, "sign_out_everywhere", requestId),
    );
  }

  async requestEmailChange(input: {
    sessionToken: string;
    currentPassword: string;
    newEmail: string;
    requestId?: string;
  }): Promise<void> {
    const session = await this.requireRecentHumanSession(input.sessionToken, "email.change");
    const account = await this.pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM accounts WHERE id = $1",
      [session.accountId],
    );
    if (!account.rows[0] || !(await verifyPassword(account.rows[0].password_hash, input.currentPassword))) {
      throw new IdentityError("INVALID_CREDENTIALS");
    }
    let newEmail: string;
    try {
      newEmail = normalizeEmail(input.newEmail);
    } catch {
      throw new IdentityError("INVALID_INPUT");
    }
    const now = this.options.clock.now();
    const token = this.options.digester.issue();
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO email_change_tokens(product_scope, account_id, new_email, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [this.options.productScope, session.accountId, newEmail, token.hash, new Date(now.getTime() + minutes(15))],
      );
      await this.securityEvent(client, session.accountId, "email.change_requested", input.requestId);
      await this.securityEmail(client, session.accountId, "verify_new_email", token.raw, newEmail);
    });
  }

  async confirmEmailChange(rawToken: string, requestId?: string): Promise<void> {
    const now = this.options.clock.now();
    await withTransaction(this.pool, async (client) => {
      const result = await client.query<{
        id: string;
        account_id: string;
        new_email: string;
        expires_at: Date;
        used_at: Date | null;
      }>(
        `SELECT id, account_id, new_email, expires_at, used_at FROM email_change_tokens
         WHERE product_scope = $1 AND token_hash = $2 FOR UPDATE`,
        [this.options.productScope, this.options.digester.digest(rawToken)],
      );
      const token = result.rows[0];
      if (!token || token.used_at || token.expires_at <= now) throw new IdentityError("INVALID_TOKEN");
      const previous = await client.query<{ email: string }>("SELECT email FROM accounts WHERE id = $1 FOR UPDATE", [
        token.account_id,
      ]);
      try {
        await client.query("UPDATE accounts SET email = $2, updated_at = $3 WHERE id = $1", [
          token.account_id,
          token.new_email,
          now,
        ]);
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
          throw new IdentityError("INVALID_TOKEN");
        }
        throw error;
      }
      await client.query("UPDATE email_change_tokens SET used_at = $2 WHERE id = $1", [token.id, now]);
      await this.securityEvent(client, token.account_id, "email.changed", requestId);
      await this.securityEmail(client, token.account_id, "email_changed_notice", undefined, previous.rows[0]?.email);
    });
  }

  async beginTotp(sessionToken: string): Promise<{ secret: string }> {
    const session = await this.requireRecentHumanSession(sessionToken, "password.change");
    const secret = randomBytes(20);
    await this.pool.query(
      `INSERT INTO totp_enrollments(account_id, product_scope, secret_ciphertext)
       VALUES ($1, $2, $3)
       ON CONFLICT(account_id) DO UPDATE SET secret_ciphertext = EXCLUDED.secret_ciphertext,
         confirmed_at = NULL, created_at = now()`,
      [session.accountId, this.options.productScope, this.options.secretBox.seal(secret)],
    );
    return { secret: encodeBase32(secret) };
  }

  async confirmTotp(sessionToken: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const session = await this.requireRecentHumanSession(sessionToken, "password.change");
    const now = this.options.clock.now();
    const enrollment = await this.pool.query<{ secret_ciphertext: string }>(
      "SELECT secret_ciphertext FROM totp_enrollments WHERE account_id = $1 AND confirmed_at IS NULL",
      [session.accountId],
    );
    const ciphertext = enrollment.rows[0]?.secret_ciphertext;
    if (!ciphertext || !verifyTotp(this.options.secretBox.open(ciphertext), code, now)) {
      throw new IdentityError("INVALID_MFA");
    }
    const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(9).toString("base64url"));
    await withTransaction(this.pool, async (client) => {
      await client.query("UPDATE totp_enrollments SET confirmed_at = $2 WHERE account_id = $1", [
        session.accountId,
        now,
      ]);
      await client.query("UPDATE accounts SET totp_secret_ciphertext = $2 WHERE id = $1", [
        session.accountId,
        ciphertext,
      ]);
      await client.query("DELETE FROM mfa_recovery_codes WHERE account_id = $1", [session.accountId]);
      for (const recoveryCode of recoveryCodes) {
        await client.query("INSERT INTO mfa_recovery_codes(account_id, code_hash) VALUES ($1, $2)", [
          session.accountId,
          this.options.digester.digest(recoveryCode),
        ]);
      }
      await this.securityEvent(client, session.accountId, "mfa.enabled");
    });
    return { recoveryCodes };
  }

  async connectionInventory(sessionToken: string): Promise<{
    sessions: Array<{ id: string; label: string | null; lastSeenAt: Date; absoluteExpiresAt: Date }>;
    grants: Array<{ id: string; clientId: string; scopes: string[]; expiresAt: Date; refreshExpiresAt: Date | null }>;
  }> {
    const session = await this.authenticate(sessionToken);
    const refreshExpirations = (await this.options.connectionRefreshExpirations?.(session.accountId)) ?? {};
    const [sessions, grants] = await Promise.all([
      this.pool.query<{ id: string; label: string | null; last_seen_at: Date; expires_at: Date }>(
        `SELECT id, label, last_seen_at, expires_at FROM sessions
         WHERE product_scope = $1 AND account_id = $2 AND revoked_at IS NULL AND expires_at > $3
         ORDER BY last_seen_at DESC`,
        [this.options.productScope, session.accountId, this.options.clock.now()],
      ),
      this.pool.query<{ id: string; client_id: string; scopes: string[]; expires_at: Date }>(
        `SELECT id, client_id, scopes, expires_at FROM oauth_grants
         WHERE product_scope = $1 AND account_id = $2 AND revoked_at IS NULL
         ORDER BY created_at DESC`,
        [this.options.productScope, session.accountId],
      ),
    ]);
    return {
      sessions: sessions.rows.map((row) => ({
        id: row.id,
        label: row.label,
        lastSeenAt: row.last_seen_at,
        absoluteExpiresAt: row.expires_at,
      })),
      grants: grants.rows
        .filter(
          (row) =>
            row.expires_at > this.options.clock.now() ||
            (refreshExpirations[row.id]?.getTime() ?? 0) > this.options.clock.now().getTime(),
        )
        .map((row) => ({
          id: row.id,
          clientId: row.client_id,
          refreshExpiresAt: refreshExpirations[row.id] ?? null,
          scopes: row.scopes,
          expiresAt: row.expires_at,
        })),
    };
  }

  /** Trusted channel adapters use this only after proving and confirming an account link. */
  async createLinkedHumanSession(accountId: string, label: string): Promise<SessionTokens & { sessionId: string }> {
    const account = await this.pool.query(
      "SELECT 1 FROM accounts WHERE product_scope = $1 AND id = $2 AND status = 'active'",
      [this.options.productScope, accountId],
    );
    if (account.rowCount !== 1) throw new IdentityError("FORBIDDEN");
    const tokens = await this.createSession(accountId, label.slice(0, 100));
    const session = await this.authenticate(tokens.sessionToken, false);
    return { ...tokens, sessionId: session.sessionId };
  }

  async revokeLinkedHumanSessions(accountId: string, sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await this.pool.query(
      `UPDATE sessions SET revoked_at = $4
       WHERE product_scope = $1 AND account_id = $2 AND id = ANY($3::uuid[]) AND revoked_at IS NULL`,
      [this.options.productScope, accountId, [...sessionIds], this.options.clock.now()],
    );
  }

  async purgeExpired(): Promise<{ unverifiedAccounts: number; credentials: number }> {
    const now = this.options.clock.now();
    return withTransaction(this.pool, async (client) => {
      const credentialResults = [];
      credentialResults.push(
        await client.query(
          "DELETE FROM sessions WHERE revoked_at IS NOT NULL OR expires_at <= $1 OR idle_expires_at <= $1",
          [now],
        ),
      );
      credentialResults.push(
        await client.query("DELETE FROM email_verification_tokens WHERE used_at IS NOT NULL OR expires_at <= $1", [
          now,
        ]),
      );
      credentialResults.push(
        await client.query("DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at <= $1", [now]),
      );
      credentialResults.push(
        await client.query("DELETE FROM email_change_tokens WHERE used_at IS NOT NULL OR expires_at <= $1", [now]),
      );
      const accounts = await client.query(
        `DELETE FROM accounts WHERE product_scope = $1 AND email_verified_at IS NULL AND NOT is_guest
         AND created_at <= $2`,
        [this.options.productScope, new Date(now.getTime() - days(7))],
      );
      return {
        unverifiedAccounts: accounts.rowCount ?? 0,
        credentials: credentialResults.reduce((sum, result) => sum + (result.rowCount ?? 0), 0),
      };
    });
  }

  private async createSession(
    accountId: string,
    label?: string,
    requestId?: string,
    mfaVerified = false,
  ): Promise<SessionTokens> {
    const now = this.options.clock.now();
    const next = this.newSessionTokens(accountId, now);
    await withTransaction(this.pool, async (client) => {
      await this.insertSession(client, next, label, now, mfaVerified);
      await this.securityEvent(client, accountId, "session.created", requestId);
    });
    return next.tokens;
  }

  private newSessionTokens(
    accountId: string,
    now: Date,
  ): {
    tokens: SessionTokens;
    sessionHash: string;
    csrfHash: string;
  } {
    const session = this.options.digester.issue();
    const csrf = this.options.digester.issue();
    const idleExpiresAt = new Date(now.getTime() + days(7));
    const absoluteExpiresAt = new Date(now.getTime() + days(30));
    return {
      tokens: { accountId, sessionToken: session.raw, csrfToken: csrf.raw, idleExpiresAt, absoluteExpiresAt },
      sessionHash: session.hash,
      csrfHash: csrf.hash,
    };
  }

  private async insertSession(
    client: PoolClient,
    next: { tokens: SessionTokens; sessionHash: string; csrfHash: string },
    label: string | undefined,
    now: Date,
    mfaVerified = false,
  ): Promise<void> {
    await client.query(
      `INSERT INTO sessions(
         product_scope, account_id, audience, token_hash, csrf_token_hash, expires_at,
         idle_expires_at, authenticated_at, last_seen_at, label, mfa_authenticated_at
       ) VALUES ($1, $2, 'human', $3, $4, $5, $6, $7, $7, $8, $9)`,
      [
        this.options.productScope,
        next.tokens.accountId,
        next.sessionHash,
        next.csrfHash,
        next.tokens.absoluteExpiresAt,
        next.tokens.idleExpiresAt,
        now,
        label?.slice(0, 100) ?? null,
        mfaVerified ? now : null,
      ],
    );
  }

  private async requireMfa(
    client: PoolClient,
    account: AccountRow,
    code: string | undefined,
    now: Date,
  ): Promise<void> {
    if (!account.totp_secret_ciphertext) {
      if (account.role === "staff") throw new IdentityError("MFA_REQUIRED");
      return;
    }
    if (!code) throw new IdentityError("MFA_REQUIRED");
    if (verifyTotp(this.options.secretBox.open(account.totp_secret_ciphertext), code, now)) return;
    const codeHash = this.options.digester.digest(code);
    const recovered = await client.query(
      `UPDATE mfa_recovery_codes SET used_at = $3
       WHERE account_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING code_hash`,
      [account.id, codeHash, now],
    );
    if (recovered.rowCount !== 1) throw new IdentityError("INVALID_MFA");
  }

  private async revokeAccess(
    client: PoolClient,
    accountId: string,
    now: Date,
    reason: string,
    requestId?: string,
  ): Promise<void> {
    await client.query("UPDATE sessions SET revoked_at = $2 WHERE account_id = $1 AND revoked_at IS NULL", [
      accountId,
      now,
    ]);
    await client.query("UPDATE oauth_grants SET revoked_at = $2 WHERE account_id = $1 AND revoked_at IS NULL", [
      accountId,
      now,
    ]);
    await this.securityEvent(client, accountId, `access.revoked.${reason}`, requestId);
    await appendOutbox(client, {
      productScope: this.options.productScope,
      eventId: randomUUID(),
      type: "access.revoked.v1",
      payload: { accountId, reason, cancelActiveRuns: true },
    });
  }

  private async securityEmail(
    client: PoolClient,
    accountId: string,
    template: string,
    token?: string,
    recipientEmail?: string,
  ): Promise<void> {
    await appendOutbox(client, {
      productScope: this.options.productScope,
      eventId: randomUUID(),
      type: "security.email.requested.v1",
      payload: {
        accountId,
        template,
        ...(token ? { sealedToken: this.options.secretBox.seal(Buffer.from(token, "utf8")) } : {}),
        ...(recipientEmail ? { recipientEmail } : {}),
      },
    });
  }

  private async securityEvent(client: PoolClient, accountId: string, type: string, requestId?: string): Promise<void> {
    await client.query(
      "INSERT INTO security_events(product_scope, account_id, type, request_id) VALUES ($1, $2, $3, $4)",
      [this.options.productScope, accountId, type, requestId ?? null],
    );
  }

  private async assertNewPassword(password: string): Promise<void> {
    try {
      validatePassword(password);
    } catch {
      throw new IdentityError("PASSWORD_REJECTED");
    }
    if (await this.options.compromisedPasswords.isCompromised(password)) {
      throw new IdentityError("PASSWORD_REJECTED");
    }
  }

  private async equalizeMissingPassword(password: string): Promise<false> {
    const candidate = [...password].length >= 15 ? password.slice(0, 128) : `${password} equalization padding`;
    await hashPassword(candidate);
    return false;
  }

  private async recordLoginFailure(email: string, ip: string, now: Date): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      await this.consumeLimit(client, "login_account", email, 5, minutes(15), now, true);
      await this.consumeLimit(client, "login_ip", ip, 30, minutes(15), now, true);
    });
  }

  private async limitReached(
    kind: string,
    subject: string,
    limit: number,
    windowMs: number,
    now: Date,
  ): Promise<boolean> {
    const bucket = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const result = await this.pool.query<{ count: number }>(
      `SELECT count FROM auth_rate_limits
       WHERE product_scope = $1 AND kind = $2 AND subject_hash = $3 AND bucket_start = $4`,
      [this.options.productScope, kind, this.options.digester.digest(subject), bucket],
    );
    return (result.rows[0]?.count ?? 0) >= limit;
  }

  private async consumeLimit(
    client: PoolClient,
    kind: string,
    subject: string,
    limit: number,
    windowMs: number,
    now: Date,
    countWhenOver: boolean,
  ): Promise<boolean> {
    const bucket = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const result = await client.query<{ count: number }>(
      `INSERT INTO auth_rate_limits(product_scope, kind, subject_hash, bucket_start, count)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT(product_scope, kind, subject_hash, bucket_start)
       DO UPDATE SET count = CASE WHEN $5 OR auth_rate_limits.count < $6
         THEN auth_rate_limits.count + 1 ELSE auth_rate_limits.count END
       RETURNING count`,
      [this.options.productScope, kind, this.options.digester.digest(subject), bucket, countWhenOver, limit],
    );
    return (result.rows[0]?.count ?? limit + 1) <= limit;
  }
}
