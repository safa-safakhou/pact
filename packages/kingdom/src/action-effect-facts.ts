import { createHash } from "node:crypto";
import { readExposureContext } from "@pact/authority";
import type { PoolClient } from "pg";

type Row = Record<string, any>;
type FactData = Record<
  | "account"
  | "ledger_kingdoms"
  | "resource_balances"
  | "kingdom_buildings"
  | "kingdom_builder_slots"
  | "social_delegations"
  | "communication_buckets"
  | "kingdom_upkeep_state"
  | "building_instructions"
  | "training_batches"
  | "kingdom_troops"
  | "kingdom_mandates"
  | "authority_ledger"
  | "authority_commitments"
  | "authority_spends"
  | "authority_commitment_assets"
  | "kingdom_action_events"
  | "supply_offers"
  | "supply_contracts"
  | "social_contacts"
  | "supply_offer_signatures"
  | "social_blocks"
  | "social_mutes"
  | "cold_contact_requests"
  | "write_leases"
  | "envoy_runs"
  | "moderation_restrictions",
  Row[]
>;
export function effectDigest(value: unknown): string {
  const canonical = (v: unknown): unknown =>
    v instanceof Date
      ? v.toISOString()
      : Array.isArray(v)
        ? v.map(canonical)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v)
                .sort(([a], [b]) => a.localeCompare(b, "en"))
                .map(([k, x]) => [k, canonical(x)]),
            )
          : v;
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
/** Complete retained dependencies, kept server-private. Never an outlook revision. */
export async function readActionEffectFacts(
  client: PoolClient,
  scope: string,
  accountId: string,
  now: Date,
  lock = false,
) {
  const clock = (
    await client.query(
      "SELECT rules_id,status,committed_game_time_ms::text,tick_sequence::text FROM world_clocks WHERE product_scope=$1",
      [scope],
    )
  ).rows[0];
  const owner = (
    await client.query(
      "SELECT id,account_id,status,ambition,ambition_version FROM kingdoms WHERE product_scope=$1 AND account_id=$2" +
        (lock ? " FOR UPDATE" : ""),
      [scope, accountId],
    )
  ).rows[0];
  if (!clock || !owner || owner.status !== "ranked") throw new Error("FORBIDDEN");
  const time = Number(clock.committed_game_time_ms),
    data: Record<string, Row[]> = {};
  const read = async (name: string, sql: string, args: unknown[] = [scope, owner.id]) => {
    const rows = (await client.query(`SELECT * FROM (${sql}) d ORDER BY to_jsonb(d)::text LIMIT 10001`, args)).rows;
    if (rows.length > 10000) throw new Error("ACTION_EFFECTS_COVERAGE_LIMIT");
    data[name] = rows;
    return rows;
  };
  await read(
    "account",
    "SELECT id,status,email_verified_at,is_guest,terms_version FROM accounts WHERE product_scope=$1 AND id=$2",
    [scope, accountId],
  );
  for (const table of [
    "ledger_kingdoms",
    "resource_balances",
    "kingdom_buildings",
    "kingdom_builder_slots",
    "social_delegations",
    "communication_buckets",
  ])
    await read(table, `SELECT * FROM ${table} WHERE product_scope=$1 AND kingdom_id=$2`);
  await read(
    "kingdom_upkeep_state",
    "SELECT * FROM kingdom_upkeep_state WHERE product_scope=$1 AND payer_kingdom_id=$2",
  );
  await read(
    "building_instructions",
    "SELECT * FROM building_instructions WHERE product_scope=$1 AND kingdom_id=$2 AND state IN('active','waiting')",
  );
  await read(
    "training_batches",
    "SELECT * FROM training_batches WHERE product_scope=$1 AND kingdom_id=$2 AND status='active'",
  );
  await read(
    "kingdom_troops",
    "SELECT * FROM kingdom_troops WHERE product_scope=$1 AND (owner_kingdom_id=$2 OR host_kingdom_id=$2)",
  );
  for (const table of ["kingdom_mandates", "authority_ledger", "authority_commitments"])
    await read(table, `SELECT * FROM ${table} WHERE product_scope=$1 AND account_id=$2`, [scope, accountId]);
  await read(
    "authority_spends",
    "SELECT * FROM authority_spends WHERE product_scope=$1 AND account_id=$2 AND game_time_ms>$3",
    [scope, accountId, time - 86400000],
  );
  await read(
    "authority_commitment_assets",
    "SELECT a.* FROM authority_commitment_assets a JOIN authority_commitments c ON c.id=a.commitment_id AND c.product_scope=a.product_scope WHERE c.product_scope=$1 AND c.account_id=$2",
    [scope, accountId],
  );
  await read(
    "kingdom_action_events",
    "SELECT * FROM kingdom_action_events WHERE product_scope=$1 AND kingdom_id=$2 AND game_time_ms>$3",
    [scope, owner.id, time - 86400000],
  );
  for (const table of ["supply_offers", "supply_contracts", "social_contacts"])
    await read(
      table,
      `SELECT * FROM ${table} WHERE product_scope=$1 AND (kingdom_a=$2 OR kingdom_b=$2)` +
        (table === "supply_offers"
          ? " AND status IN('open','active')"
          : table === "supply_contracts"
            ? " AND status='active'"
            : ""),
    );
  await read(
    "supply_offer_signatures",
    "SELECT s.* FROM supply_offer_signatures s JOIN supply_offers o ON o.id=s.offer_id AND o.product_scope=s.product_scope WHERE o.product_scope=$1 AND (o.kingdom_a=$2 OR o.kingdom_b=$2) AND o.status IN('open','active')",
  );
  await read(
    "social_blocks",
    "SELECT * FROM social_blocks WHERE product_scope=$1 AND (blocker_kingdom_id=$2 OR blocked_kingdom_id=$2)",
  );
  await read(
    "social_mutes",
    "SELECT * FROM social_mutes WHERE product_scope=$1 AND (muter_kingdom_id=$2 OR muted_kingdom_id=$2)",
  );
  await read(
    "cold_contact_requests",
    "SELECT id,sender_kingdom_id,recipient_kingdom_id,status,expires_game_time_ms,octet_length(note) bytes FROM cold_contact_requests WHERE product_scope=$1 AND (sender_kingdom_id=$2 OR recipient_kingdom_id=$2) AND status='pending'",
  );
  await read(
    "write_leases",
    "SELECT l.* FROM write_leases l LEFT JOIN envoy_runs r ON r.run_id=l.run_id WHERE l.product_scope=$1 AND (l.subject_id=$2 OR r.account_id=$2)",
    [scope, accountId],
  );
  await read(
    "envoy_runs",
    "SELECT run_id,status,subject_id,deadline_at,max_messages,used_messages FROM envoy_runs WHERE product_scope=$1 AND account_id=$2 AND status IN('running','waiting')",
    [scope, accountId],
  );
  await read(
    "moderation_restrictions",
    "SELECT kind,until_at FROM moderation_restrictions WHERE product_scope=$1 AND account_id=$2",
    [scope, accountId],
  );
  const authority = await readExposureContext(client, scope, accountId, time);
  return {
    owner,
    clock,
    time,
    now,
    data: data as FactData,
    authority,
    revision: effectDigest({ owner, clock, data, authority }),
  };
}
export type ActionEffectFacts = Awaited<ReturnType<typeof readActionEffectFacts>>;

/** Private guards for counterpart-dependent predicates; only a digest leaves this boundary. */
export async function readActionEffectPeer(client: PoolClient, scope: string, own: string, peer: string) {
  const rows: unknown[] = [];
  const account = (
    await client.query("SELECT account_id FROM kingdoms WHERE product_scope=$1 AND id=$2 AND status='ranked'", [
      scope,
      peer,
    ])
  ).rows[0];
  if (!account) throw new Error("FORBIDDEN");
  const peerFacts = await readActionEffectFacts(client, scope, account.account_id, new Date());
  for (const [table, predicate] of [
    ["kingdoms", "id=$2"],
    ["resource_balances", "kingdom_id=$2"],
    ["ledger_kingdoms", "kingdom_id=$2"],
    ["supply_contracts", "(kingdom_a=$2 OR kingdom_b=$2) AND status='active'"],
    ["supply_offers", "(kingdom_a=$2 OR kingdom_b=$2) AND status IN('open','active')"],
    ["social_blocks", "(blocker_kingdom_id=$2 OR blocked_kingdom_id=$2)"],
    ["social_contacts", "(kingdom_a=$2 OR kingdom_b=$2)"],
  ]) {
    const found = (
      await client.query(
        `SELECT * FROM ${table} d WHERE product_scope=$1 AND ${predicate} ORDER BY to_jsonb(d)::text LIMIT 10001`,
        [scope, peer],
      )
    ).rows;
    if (found.length > 10000) throw new Error("ACTION_EFFECTS_COVERAGE_LIMIT");
    rows.push({ table, found });
  }
  const requests = (
    await client.query(
      "SELECT id,status,expires_game_time_ms,octet_length(note) bytes FROM cold_contact_requests WHERE product_scope=$1 AND recipient_kingdom_id=$2 AND status='pending' ORDER BY id LIMIT 10001",
      [scope, peer],
    )
  ).rows;
  const messages = (
    await client.query(
      "SELECT id,octet_length(body) bytes FROM direct_messages WHERE product_scope=$1 AND recipient_kingdom_id=$2 AND read_game_time_ms IS NULL ORDER BY id LIMIT 10001",
      [scope, peer],
    )
  ).rows;
  if (requests.length > 10000 || messages.length > 10000) throw new Error("ACTION_EFFECTS_COVERAGE_LIMIT");
  return {
    revision: effectDigest({ own, peer, peerRevision: peerFacts.revision, rows, requests, messages }),
    pendingIntroductionBytes: requests.reduce((n, r) => n + Number(r.bytes), 0),
    unreadBytes: messages.reduce((n, r) => n + Number(r.bytes), 0),
  };
}
