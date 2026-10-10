import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { applyReviewedMandate } from "@pact/authority";
import { createPool, withTransaction } from "@pact/db";
import { ActionLimitService, SocialService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";

// Only existing gameplay permissions; hardcoded human-only gameplay and account/security actions stay separate.
export const PROFILE = Object.freeze({
  allowedActions: [
    "world.read",
    "inbox.read",
    "message.send.contact",
    "contact.request",
    "transfer",
    "training.queue",
    "building.queue",
    "scout.start",
    "supply.sign",
    "supply.break",
    "garrison.sign",
    "garrison.break",
    "raid.commit",
  ],
  targetRestrictions: [],
  resourceLimits: { iron: "999999999999999999", silver: "999999999999999999", grain: "999999999999999999" },
  reserveFloors: { iron: "0", silver: "0", grain: "0" },
  troopLimit: 2147483647,
  sessionLimit: 1,
});
const reference = "founder-20261010-all-existing-agent-gameplay";
export const digest = (value) => createHash("sha256").update(value).digest("hex");

async function cohort(client) {
  return (
    await client.query(`SELECT a.id AS account_id,k.id AS kingdom_id,m.version AS mandate_version,
    m.allowed_actions,m.target_restrictions,m.resource_limits,m.reserve_floors,m.troop_limit,m.session_limit,
    d.version AS delegation_version,d.mode,d.allowed_kingdom_ids,d.enrolled_game_time_ms
    FROM accounts a JOIN kingdoms k ON k.product_scope=a.product_scope AND k.account_id=a.id
    LEFT JOIN kingdom_mandates m ON m.product_scope=a.product_scope AND m.account_id=a.id
    LEFT JOIN social_delegations d ON d.product_scope=k.product_scope AND d.kingdom_id=k.id
    WHERE a.product_scope='pact' AND a.status='active' AND (a.email_verified_at IS NOT NULL OR a.is_guest)
      AND k.status='ranked' ORDER BY a.id`)
  ).rows;
}

export async function preview(pool) {
  const entries = await withTransaction(pool, cohort);
  return {
    format: "reviewed-existing-gameplay-v1",
    authorizationReference: reference,
    createdAt: new Date().toISOString(),
    profile: PROFILE,
    entries,
  };
}

export async function apply(pool, plan) {
  if (
    plan.format !== "reviewed-existing-gameplay-v1" ||
    plan.authorizationReference !== reference ||
    JSON.stringify(plan.profile) !== JSON.stringify(PROFILE) ||
    !Array.isArray(plan.entries) ||
    plan.entries.length === 0 ||
    !Number.isFinite(Date.parse(plan.createdAt)) ||
    Date.now() - Date.parse(plan.createdAt) > 3600000 ||
    Date.parse(plan.createdAt) > Date.now()
  )
    throw Error("INVALID_OR_EXPIRED_PLAN");
  const social = new SocialService("pact", new ResourceLedger("pact"), new ActionLimitService("pact"), {
    now: () => new Date(),
  });
  return withTransaction(pool, async (client) => {
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    // Freeze the complete reviewed eligible cohort; a new kingdom or any owner edit requires a fresh preview.
    const before = await cohort(client);
    if (JSON.stringify(before) !== JSON.stringify(plan.entries)) throw Error("COHORT_CHANGED");
    const clock = (
      await client.query("SELECT committed_game_time_ms AS game_time_ms FROM world_clocks WHERE product_scope='pact'")
    ).rows[0];
    if (!clock) throw Error("WORLD_CLOCK_MISSING");
    for (const entry of before) {
      await applyReviewedMandate(client, {
        productScope: "pact",
        accountId: entry.account_id,
        expectedVersion: entry.mandate_version,
        authorizationReference: reference,
        profile: PROFILE,
      });
      await social.configureDelegation(
        client,
        entry.account_id,
        { mode: "agent_decides", allowedKingdomIds: [], expectedVersion: entry.delegation_version ?? 0 },
        Number(clock.game_time_ms),
      );
    }
    return {
      updated: before.length,
      authorizationReference: reference,
      profile: "broad-existing-gameplay-v1",
      status: "committed",
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, path, expectedDigest] = process.argv.slice(2);
  if (!["preview", "apply"].includes(mode) || !path || !isAbsolute(path))
    throw Error("usage: preview ABSOLUTE_PRIVATE_PLAN | apply ABSOLUTE_PRIVATE_PLAN SHA256");
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL_REQUIRED");
  const pool = createPool(process.env.DATABASE_URL);
  try {
    if (mode === "preview") {
      const plan = await preview(pool),
        bytes = JSON.stringify(plan);
      await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
      console.log(
        JSON.stringify({
          eligibleKingdoms: plan.entries.length,
          sha256: digest(bytes),
          profile: "broad-existing-gameplay-v1",
        }),
      );
    } else {
      const bytes = await readFile(path, "utf8");
      if (!expectedDigest || digest(bytes) !== expectedDigest) throw Error("PLAN_DIGEST_MISMATCH");
      console.log(JSON.stringify(await apply(pool, JSON.parse(bytes))));
    }
  } finally {
    await pool.end();
  }
}
