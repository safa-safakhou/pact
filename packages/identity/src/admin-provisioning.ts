import { randomBytes } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool } from "pg";
import { encodeBase32, hashPassword, type TokenDigester, validatePassword, verifyTotp } from "./crypto.js";
import { type CompromisedPasswordChecker, IdentityError, type SecretBox } from "./types.js";

/** Host-authorized first administrator. No draft, kingdom, grant or game authority is created. */
export class AdminProvisioning {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly box: SecretBox,
    private readonly digester: TokenDigester,
    private readonly compromised: CompromisedPasswordChecker,
  ) {}

  async available(): Promise<boolean> {
    return !(
      await this.pool.query(
        `SELECT 1 FROM accounts WHERE product_scope=$1 AND role='staff'
      UNION ALL SELECT 1 FROM security_events WHERE product_scope=$1 AND type='admin.provisioned' LIMIT 1`,
        [this.scope],
      )
    ).rowCount;
  }

  begin() {
    const secret = randomBytes(20);
    return { secret: secret.toString("base64url"), authenticatorKey: encodeBase32(secret) };
  }

  async complete(input: { username: string; password: string; secret: string; code: string }, now: Date) {
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(input.username)) throw new IdentityError("INVALID_INPUT");
    try {
      validatePassword(input.password);
    } catch {
      throw new IdentityError("INVALID_INPUT");
    }
    if (await this.compromised.isCompromised(input.password)) throw new IdentityError("PASSWORD_REJECTED");
    const secret = Buffer.from(input.secret, "base64url");
    if (secret.length !== 20 || !verifyTotp(secret, input.code, now)) throw new IdentityError("FORBIDDEN");
    const passwordHash = await hashPassword(input.password);
    const recoveryCodes = Array.from({ length: 10 }, () => this.digester.issue(16));
    await withTransaction(this.pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`admin-bootstrap:${this.scope}`]);
      if (
        (
          await client.query(
            `SELECT 1 FROM accounts WHERE product_scope=$1 AND role='staff'
        UNION ALL SELECT 1 FROM security_events WHERE product_scope=$1 AND type='admin.provisioned' LIMIT 1`,
            [this.scope],
          )
        ).rowCount
      )
        throw new IdentityError("FORBIDDEN");
      const account = await client.query<{ id: string }>(
        `INSERT INTO accounts(product_scope,email,password_hash,email_verified_at,role,totp_secret_ciphertext)
         VALUES($1,$2,$3,$4,'staff',$5) RETURNING id`,
        [this.scope, adminEmail(input.username), passwordHash, now, this.box.seal(secret)],
      );
      await client.query(
        "INSERT INTO security_events(product_scope,account_id,type,occurred_at) VALUES($1,$2,'admin.provisioned',$3)",
        [this.scope, account.rows[0]?.id, now],
      );
      for (const code of recoveryCodes)
        await client.query("INSERT INTO mfa_recovery_codes(account_id,code_hash,created_at) VALUES($1,$2,$3)", [
          account.rows[0]?.id,
          code.hash,
          now,
        ]);
    });
    return { created: true, username: input.username, recoveryCodes: recoveryCodes.map((c) => c.raw) };
  }
}

export function adminEmail(username: string): string {
  return `${username}@operators.pact.invalid`;
}
