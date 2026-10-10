import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import type { PoolClient } from "pg";
import { AuthorityError, type MandateView } from "./service.js";

/** Database-operator maintenance only. Never register this capability as a human/agent HTTP or MCP route. */
export async function applyReviewedMandate(
  client: PoolClient,
  input: {
    productScope: string;
    accountId: string;
    expectedVersion: number | null;
    authorizationReference: string;
    profile: Omit<MandateView, "accountId" | "version">;
  },
): Promise<number> {
  const { profile } = input;
  const forbidden = new Set(["authority.raise", "credential.read", "approval.commit", "account.delete", "checkout"]);
  if (
    !input.authorizationReference.trim() ||
    profile.allowedActions.some((action) => forbidden.has(action)) ||
    Object.values(profile.resourceLimits).some((value) => !/^(0|[1-9][0-9]{0,17})$/.test(value)) ||
    Object.values(profile.reserveFloors).some((value) => !/^(0|[1-9][0-9]{0,17})$/.test(value)) ||
    !Number.isInteger(profile.troopLimit) ||
    profile.troopLimit < 0 ||
    profile.troopLimit > 2147483647 ||
    profile.sessionLimit !== 1
  )
    throw new AuthorityError("FORBIDDEN");
  const account = await client.query(
    "SELECT id FROM accounts WHERE product_scope=$1 AND id=$2 AND status='active' AND (email_verified_at IS NOT NULL OR is_guest) FOR UPDATE",
    [input.productScope, input.accountId],
  );
  if (account.rowCount !== 1) throw new AuthorityError("FORBIDDEN");
  const current = await client.query<{ version: number }>(
    "SELECT version FROM kingdom_mandates WHERE product_scope=$1 AND account_id=$2 FOR UPDATE",
    [input.productScope, input.accountId],
  );
  if ((current.rows[0]?.version ?? null) !== input.expectedVersion) throw new AuthorityError("STALE_VERSION");
  const version = (input.expectedVersion ?? 0) + 1;
  await client.query(
    `INSERT INTO kingdom_mandates(product_scope,account_id,version,allowed_actions,target_restrictions,resource_limits,reserve_floors,troop_limit,session_limit)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
     ON CONFLICT(product_scope,account_id) DO UPDATE SET version=EXCLUDED.version,allowed_actions=EXCLUDED.allowed_actions,
       target_restrictions=EXCLUDED.target_restrictions,resource_limits=EXCLUDED.resource_limits,reserve_floors=EXCLUDED.reserve_floors,
       troop_limit=EXCLUDED.troop_limit,session_limit=EXCLUDED.session_limit,updated_at=clock_timestamp()`,
    [
      input.productScope,
      input.accountId,
      version,
      [...profile.allowedActions],
      [...profile.targetRestrictions],
      JSON.stringify(profile.resourceLimits),
      JSON.stringify(profile.reserveFloors),
      profile.troopLimit,
      profile.sessionLimit,
    ],
  );
  await appendOutbox(client, {
    productScope: input.productScope,
    eventId: randomUUID(),
    type: "operator.mandate.changed.v1",
    payload: {
      accountId: input.accountId,
      priorVersion: input.expectedVersion,
      version,
      authorizationReference: input.authorizationReference,
    },
  });
  return version;
}
