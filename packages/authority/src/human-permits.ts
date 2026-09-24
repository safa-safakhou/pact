import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { HumanPermitPort } from "./exposure.js";

function encodedAssets(assets: Readonly<Record<string, bigint>>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(assets)
        .filter(([, amount]) => amount !== 0n)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([asset, amount]) => [asset, amount.toString()]),
    ),
  );
}

function storedAssetsMatch(stored: Readonly<Record<string, string>>, requested: string): boolean {
  return (
    JSON.stringify(Object.fromEntries(Object.entries(stored).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))) ===
    requested
  );
}

/** Issue and consume exact one-use permits only under a currently authenticated human session. */
export class ExactHumanPermitService implements HumanPermitPort {
  constructor(private readonly productScope: string) {}

  async issue(
    client: PoolClient,
    input: {
      accountId: string;
      humanSessionId: string;
      action: string;
      operationKey: string;
      assets: Readonly<Record<string, bigint>>;
      troopCount?: number;
      permitId?: string;
    },
  ): Promise<string> {
    const session = await client.query(
      `SELECT 1 WHERE EXISTS (
         SELECT 1 FROM sessions WHERE product_scope = $1 AND account_id = $2 AND id = $3
           AND audience = 'human' AND revoked_at IS NULL AND expires_at > clock_timestamp()
           AND idle_expires_at > clock_timestamp()
       ) OR EXISTS (
         SELECT 1 FROM oauth_grants WHERE product_scope = $1 AND account_id = $2 AND id = $3
           AND audience = 'human' AND revoked_at IS NULL AND expires_at > clock_timestamp()
           AND 'game:act' = ANY(scopes)
       )`,
      [this.productScope, input.accountId, input.humanSessionId],
    );
    if (session.rowCount !== 1) throw new Error("HUMAN_SESSION_REQUIRED");
    const assets = encodedAssets(input.assets);
    const existing = await client.query<{
      id: string;
      session_id: string;
      assets: Record<string, string>;
      troop_count: number;
    }>(
      `SELECT id, session_id, assets, troop_count FROM authority_human_permits
       WHERE product_scope = $1 AND account_id = $2 AND action = $3 AND operation_key = $4 FOR UPDATE`,
      [this.productScope, input.accountId, input.action, input.operationKey],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (
        (input.permitId !== undefined && row.id !== input.permitId) ||
        row.session_id !== input.humanSessionId ||
        !storedAssetsMatch(row.assets, assets) ||
        row.troop_count !== (input.troopCount ?? 0)
      )
        throw new Error("HUMAN_PERMIT_CONFLICT");
      return row.id;
    }
    const permitId = input.permitId ?? randomUUID();
    await client.query(
      `INSERT INTO authority_human_permits(id, product_scope, account_id, session_id, action,
         operation_key, assets, troop_count, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, clock_timestamp() + interval '15 minutes')`,
      [
        permitId,
        this.productScope,
        input.accountId,
        input.humanSessionId,
        input.action,
        input.operationKey,
        assets,
        input.troopCount ?? 0,
      ],
    );
    return permitId;
  }

  async assertExact(
    client: PoolClient,
    input: {
      accountId: string;
      permitRef: string;
      action: string;
      operationKey: string;
      assets: Readonly<Record<string, bigint>>;
      troopCount: number;
    },
  ): Promise<void> {
    const result = await client.query<{
      assets: Record<string, string>;
      troop_count: number;
      used_at: Date | null;
    }>(
      `SELECT p.assets, p.troop_count, p.used_at FROM authority_human_permits p
       WHERE p.id = $1 AND p.product_scope = $2 AND p.account_id = $3
         AND p.action = $4 AND p.operation_key = $5
         AND p.expires_at > clock_timestamp()
         AND (EXISTS (
           SELECT 1 FROM sessions s WHERE s.id = p.session_id AND s.product_scope = p.product_scope
             AND s.account_id = p.account_id AND s.audience = 'human'
             AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
             AND s.idle_expires_at > clock_timestamp()
         ) OR EXISTS (
           SELECT 1 FROM oauth_grants g WHERE g.id = p.session_id AND g.product_scope = p.product_scope
             AND g.account_id = p.account_id AND g.audience = 'human'
             AND g.revoked_at IS NULL AND g.expires_at > clock_timestamp()
             AND 'game:act' = ANY(g.scopes)
         )) FOR UPDATE OF p`,
      [input.permitRef, this.productScope, input.accountId, input.action, input.operationKey],
    );
    const row = result.rows[0];
    if (
      !row ||
      row.used_at ||
      row.troop_count !== input.troopCount ||
      !storedAssetsMatch(row.assets, encodedAssets(input.assets))
    )
      throw new Error("INVALID_EXACT_PERMIT");
    await client.query("UPDATE authority_human_permits SET used_at = clock_timestamp() WHERE id = $1", [
      input.permitRef,
    ]);
  }
}
