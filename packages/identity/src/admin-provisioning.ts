import { withTransaction } from "@pact/db";
import type { Pool } from "pg";
import { hashPassword, validatePassword } from "./crypto.js";
import { type CompromisedPasswordChecker, IdentityError } from "./types.js";

/** Host-authorized first administrator. No draft, kingdom, grant or game authority is created. */
export class AdminProvisioning {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
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

  async complete(input: { username: string; password: string }, now: Date) {
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(input.username)) throw new IdentityError("INVALID_INPUT");
    try {
      validatePassword(input.password);
    } catch {
      throw new IdentityError("INVALID_INPUT");
    }
    if (await this.compromised.isCompromised(input.password)) throw new IdentityError("PASSWORD_REJECTED");
    const passwordHash = await hashPassword(input.password);
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
        `INSERT INTO accounts(product_scope,email,password_hash,email_verified_at,role,staff_auth_policy)
         VALUES($1,$2,$3,$4,'staff','password') RETURNING id`,
        [this.scope, adminEmail(input.username), passwordHash, now],
      );
      await client.query(
        "INSERT INTO security_events(product_scope,account_id,type,occurred_at) VALUES($1,$2,'admin.provisioned',$3)",
        [this.scope, account.rows[0]?.id, now],
      );
    });
    return { created: true, username: input.username };
  }
}

export function adminEmail(username: string): string {
  return `${username}@operators.pact.invalid`;
}
