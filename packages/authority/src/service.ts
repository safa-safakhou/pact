import { withTransaction } from "@pact/db";
import type { HumanSession, IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import type { Pool, PoolClient } from "pg";

export type MandateAsset = "grain" | "ore" | "influence" | "gems";

export interface MandateView {
  readonly accountId: string;
  readonly version: number;
  readonly allowedActions: readonly string[];
  readonly targetRestrictions: readonly string[];
  readonly resourceLimits: Readonly<Record<string, string>>;
  readonly reserveFloors: Readonly<Record<string, string>>;
  readonly troopLimit: number;
  readonly sessionLimit: number;
}

export class AuthorityError extends Error {
  constructor(readonly code: "FORBIDDEN" | "INSUFFICIENT_ALLOWANCE" | "STALE_VERSION" | "RECENT_AUTH_REQUIRED") {
    super(code);
    this.name = "AuthorityError";
  }
}

const DEFAULT_ACTIONS = ["world.read", "inbox.read", "message.send.contact"] as const;

interface MandateRow {
  account_id: string;
  version: number;
  allowed_actions: string[];
  target_restrictions: string[];
  resource_limits: Record<string, string>;
  reserve_floors: Record<string, string>;
  troop_limit: number;
  session_limit: number;
}

export class AuthorityService {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      identity: IdentityService;
      now: () => Date;
    },
  ) {}

  async ensureMandate(accountId: string): Promise<MandateView> {
    const existing = await this.getMandate(accountId);
    if (existing) return existing;
    await this.pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits, reserve_floors)
       VALUES ($1, $2, $3, '{}'::jsonb, '{}'::jsonb)
       ON CONFLICT(product_scope, account_id) DO NOTHING`,
      [this.options.productScope, accountId, [...DEFAULT_ACTIONS]],
    );
    const created = await this.getMandate(accountId);
    if (!created) throw new Error("mandate missing after insert");
    return created;
  }

  async getMandate(accountId: string): Promise<MandateView | null> {
    const result = await this.pool.query<MandateRow>(
      `SELECT account_id, version, allowed_actions, target_restrictions, resource_limits, reserve_floors,
              troop_limit, session_limit
       FROM kingdom_mandates WHERE product_scope = $1 AND account_id = $2`,
      [this.options.productScope, accountId],
    );
    const row = result.rows[0];
    return row ? this.toView(row) : null;
  }

  async raiseMandate(
    sessionToken: string,
    input: {
      allowedActions: readonly string[];
      resourceLimits: Readonly<Record<string, string>>;
      reserveFloors?: Readonly<Record<string, string>>;
      troopLimit?: number;
      sessionLimit?: number;
      expectedVersion: number;
    },
  ): Promise<MandateView> {
    let session: HumanSession;
    try {
      session = await this.options.identity.requireRecentHumanSession(sessionToken, "authority.raise");
    } catch (error) {
      if (error instanceof IdentityError && error.code === "RECENT_AUTH_REQUIRED") {
        throw new AuthorityError("RECENT_AUTH_REQUIRED");
      }
      if (error instanceof IdentityError && error.code === "FORBIDDEN") {
        throw new AuthorityError("FORBIDDEN");
      }
      throw error;
    }
    return withTransaction(this.pool, async (client) => {
      await this.ensureMandateInTx(client, session.accountId);
      const current = await client.query<MandateRow>(
        `SELECT * FROM kingdom_mandates WHERE product_scope = $1 AND account_id = $2 FOR UPDATE`,
        [this.options.productScope, session.accountId],
      );
      const row = current.rows[0];
      if (!row || row.version !== input.expectedVersion) throw new AuthorityError("STALE_VERSION");
      const updated = await client.query<MandateRow>(
        `UPDATE kingdom_mandates SET
           version = version + 1,
           allowed_actions = $3,
           resource_limits = $4::jsonb,
           reserve_floors = $5::jsonb,
           troop_limit = $6,
           session_limit = $7,
           updated_at = $8
         WHERE product_scope = $1 AND account_id = $2 RETURNING *`,
        [
          this.options.productScope,
          session.accountId,
          [...input.allowedActions],
          JSON.stringify(input.resourceLimits),
          JSON.stringify(input.reserveFloors ?? row.reserve_floors),
          input.troopLimit ?? row.troop_limit,
          input.sessionLimit ?? row.session_limit,
          this.options.now(),
        ],
      );
      const next = updated.rows[0];
      if (!next) throw new Error("mandate update failed");
      return this.toView(next);
    });
  }

  /** Agents and MCP tokens cannot mutate mandates through this path. */
  async assertAgentCannotMutateMandate(audience: "human" | "agent" | "service" | "mcp"): Promise<void> {
    if (audience !== "human") throw new AuthorityError("FORBIDDEN");
  }

  async assertActionAllowed(
    accountId: string,
    action: string,
    options?: { mandateVersion?: number },
  ): Promise<MandateView> {
    const mandate = await this.ensureMandate(accountId);
    if (options?.mandateVersion !== undefined && options.mandateVersion !== mandate.version) {
      throw new AuthorityError("STALE_VERSION");
    }
    const humanOnly = new Set(["authority.raise", "credential.read", "approval.commit", "account.delete", "checkout"]);
    if (humanOnly.has(action)) throw new AuthorityError("FORBIDDEN");
    if (!mandate.allowedActions.includes(action)) {
      throw new AuthorityError("FORBIDDEN");
    }
    return mandate;
  }

  async spendImmediate(
    accountId: string,
    asset: MandateAsset,
    units: bigint,
  ): Promise<{ spent: bigint; reserved: bigint; limit: bigint }> {
    if (units <= 0n) throw new AuthorityError("INSUFFICIENT_ALLOWANCE");
    return withTransaction(
      this.pool,
      async (client) => {
        await client.query("SELECT id FROM accounts WHERE id = $1 AND product_scope = $2 FOR UPDATE", [
          accountId,
          this.options.productScope,
        ]);
        const mandate = await client.query<MandateRow>(
          `SELECT * FROM kingdom_mandates WHERE product_scope = $1 AND account_id = $2 FOR UPDATE`,
          [this.options.productScope, accountId],
        );
        const row = mandate.rows[0];
        if (!row) throw new AuthorityError("FORBIDDEN");
        const limit = BigInt(row.resource_limits[asset] ?? "0");
        if (limit <= 0n) throw new AuthorityError("INSUFFICIENT_ALLOWANCE");
        await client.query(
          `INSERT INTO authority_ledger(product_scope, account_id, asset, spent_units, reserved_units, updated_at)
           VALUES ($1, $2, $3, 0, 0, $4)
           ON CONFLICT DO NOTHING`,
          [this.options.productScope, accountId, asset, this.options.now()],
        );
        const ledger = await client.query<{ spent_units: string; reserved_units: string }>(
          `SELECT spent_units::text, reserved_units::text FROM authority_ledger
           WHERE product_scope = $1 AND account_id = $2 AND asset = $3 FOR UPDATE`,
          [this.options.productScope, accountId, asset],
        );
        const entry = ledger.rows[0];
        if (!entry) throw new Error("ledger missing");
        const spent = BigInt(entry.spent_units);
        const reserved = BigInt(entry.reserved_units);
        const future = await client.query<{ total: string }>(
          `SELECT COALESCE(sum(units), 0)::text AS total FROM authority_spends
           WHERE product_scope = $1 AND account_id = $2 AND asset = $3 AND count_against_limit`,
          [this.options.productScope, accountId, asset],
        );
        if (spent + reserved + BigInt(future.rows[0]?.total ?? "0") + units > limit)
          throw new AuthorityError("INSUFFICIENT_ALLOWANCE");
        const nextSpent = spent + units;
        await client.query(
          `UPDATE authority_ledger SET spent_units = $4, updated_at = $5
           WHERE product_scope = $1 AND account_id = $2 AND asset = $3`,
          [this.options.productScope, accountId, asset, nextSpent.toString(), this.options.now()],
        );
        return { spent: nextSpent, reserved, limit };
      },
      { isolation: "SERIALIZABLE" },
    );
  }

  private async ensureMandateInTx(client: PoolClient, accountId: string): Promise<void> {
    await client.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions)
       VALUES ($1, $2, $3)
       ON CONFLICT(product_scope, account_id) DO NOTHING`,
      [this.options.productScope, accountId, [...DEFAULT_ACTIONS]],
    );
  }

  private toView(row: MandateRow): MandateView {
    return {
      accountId: row.account_id,
      version: row.version,
      allowedActions: row.allowed_actions,
      targetRestrictions: row.target_restrictions,
      resourceLimits: row.resource_limits,
      reserveFloors: row.reserve_floors,
      troopLimit: row.troop_limit,
      sessionLimit: row.session_limit,
    };
  }
}

/** Transaction-bound read for game settlement; absent mandates have the documented zero floor. */
export async function readReserveFloor(
  client: PoolClient,
  productScope: string,
  accountId: string,
  asset: string,
): Promise<bigint> {
  const result = await client.query<{ reserve_floors: Record<string, string> }>(
    "SELECT reserve_floors FROM kingdom_mandates WHERE product_scope = $1 AND account_id = $2",
    [productScope, accountId],
  );
  const raw = result.rows[0]?.reserve_floors?.[asset] ?? "0";
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error("INVALID_RESERVE_FLOOR");
  return BigInt(raw);
}

/** Read-only owner-bound inference context port, with no human-authentication capability. */
export async function readMandateContext(client: PoolClient, productScope: string, accountId: string) {
  const row = (
    await client.query<MandateRow>(
      "SELECT account_id,version,allowed_actions,target_restrictions,resource_limits,reserve_floors,troop_limit,session_limit FROM kingdom_mandates WHERE product_scope=$1 AND account_id=$2",
      [productScope, accountId],
    )
  ).rows[0];
  return row
    ? {
        version: row.version,
        allowedActions: row.allowed_actions,
        targetRestrictions: row.target_restrictions,
        resourceLimits: row.resource_limits,
        reserveFloors: row.reserve_floors,
        troopLimit: row.troop_limit,
        sessionLimit: row.session_limit,
      }
    : { allowedActions: ["world.read"], resourceLimits: {}, reserveFloors: {}, troopLimit: 0, version: null };
}
