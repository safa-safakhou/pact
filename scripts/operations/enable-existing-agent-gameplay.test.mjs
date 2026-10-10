import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { applyReviewedMandate, ExposureService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { ActionLimitService, SocialService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { WorldClockService } from "@pact/world";
import { apply, PROFILE, preview } from "./enable-existing-agent-gameplay.mjs";

let admin, pool, schema, social;
const connection = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
before(async () => {
  admin = createPool(connection);
  schema = await createTestSchema(admin, "reviewed_permission");
  pool = createSchemaPool(connection, schema);
  social = new SocialService("pact", new ResourceLedger("pact"), new ActionLimitService("pact"), {
    now: () => new Date(),
  });
  await new WorldClockService(pool, "pact").bootstrap();
});
after(async () => {
  await pool?.end();
  if (schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function owner({ scope = "pact", status = "active", verified = true, kingdom = true } = {}) {
  const accountId = randomUUID(),
    kingdomId = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,status,email_verified_at) VALUES($1,$2,$3,'synthetic',$4,$5)",
    [accountId, scope, `${accountId}@example.test`, status, verified ? new Date() : null],
  );
  if (kingdom)
    await pool.query(
      `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,
    activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id)
    VALUES($1,$2,$3,$4,'Synthetic','portrait.wolf',now(),0,0,60000,$5)`,
      [kingdomId, scope, accountId, `test_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
  return { accountId, kingdomId };
}
test("reviewed cohort, contact delegation and exact version updates preserve ledgers and credentials", async () => {
  const a = await owner(),
    b = await owner();
  await owner({ status: "closing" });
  await owner({ verified: false });
  await owner({ scope: "other" });
  await owner({ kingdom: false });
  await pool.query(
    "INSERT INTO kingdom_mandates(product_scope,account_id,allowed_actions,target_restrictions,resource_limits,reserve_floors) VALUES('pact',$1,ARRAY['world.read'],ARRAY['old-target'],'{\"grain\":\"10\"}','{\"grain\":\"4\"}')",
    [a.accountId],
  );
  await pool.query(
    "INSERT INTO authority_ledger(product_scope,account_id,asset,spent_units,reserved_units) VALUES('pact',$1,'grain',7,2)",
    [a.accountId],
  );
  const request = await withTransaction(pool, (c) =>
    social.requestContact(c, {
      accountId: a.accountId,
      recipientKingdomId: b.kingdomId,
      note: "Synthetic hello",
      operationKey: randomUUID(),
      gameTimeMs: 0,
    }),
  );
  await assert.rejects(
    withTransaction(pool, (c) =>
      social.answerRequest(c, {
        accountId: b.accountId,
        requestId: request,
        accept: true,
        actorKind: "agent",
        gameTimeMs: 0,
      }),
    ),
    (e) => e.code === "DELEGATION_REQUIRED",
  );
  const plan = await preview(pool);
  assert.equal(plan.entries.length, 2);
  const invalid = structuredClone(plan);
  invalid.profile.allowedActions.push("credential.read");
  await assert.rejects(apply(pool, invalid), /INVALID_OR_EXPIRED_PLAN/);
  const stale = structuredClone(plan);
  stale.entries[0].troop_limit = 999;
  await assert.rejects(apply(pool, stale), /COHORT_CHANGED/);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM social_delegations")).rows[0].n, 0);
  const result = await apply(pool, plan);
  assert.equal(result.updated, 2);
  const mandates = (
    await pool.query(
      "SELECT version,allowed_actions,target_restrictions,resource_limits,reserve_floors,troop_limit,session_limit FROM kingdom_mandates ORDER BY account_id",
    )
  ).rows;
  assert.deepEqual(mandates.map((r) => r.version).sort(), [1, 2]);
  for (const row of mandates) {
    assert.deepEqual(row.allowed_actions, PROFILE.allowedActions);
    assert.deepEqual(row.target_restrictions, []);
    assert.deepEqual(row.resource_limits, PROFILE.resourceLimits);
    assert.deepEqual(row.reserve_floors, PROFILE.reserveFloors);
    assert.equal(row.session_limit, 1);
    assert.equal(row.troop_limit, 2147483647);
  }
  assert.deepEqual((await pool.query("SELECT spent_units::text,reserved_units::text FROM authority_ledger")).rows, [
    { spent_units: "7", reserved_units: "2" },
  ]);
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE type='operator.mandate.changed.v1'")).rows[0]
      .n,
    2,
  );
  await withTransaction(pool, (c) =>
    social.answerRequest(c, {
      accountId: b.accountId,
      requestId: request,
      accept: true,
      actorKind: "agent",
      gameTimeMs: 0,
    }),
  );
  await assert.rejects(apply(pool, plan), /COHORT_CHANGED/);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM oauth_grants")).rows[0].n, 0);
  const exposure = new ExposureService("pact");
  await withTransaction(pool, (c) => exposure.assertActionAllowed(c, a.accountId, "raid.commit", 2));
  await assert.rejects(
    withTransaction(pool, (c) => exposure.assertActionAllowed(c, a.accountId, "raid.commit", 1)),
    (e) => e.code === "STALE_MANDATE",
  );
});
test("operator mutation fails closed on foreign/closing accounts, admin permissions, stale versions and rollback", async () => {
  const a = await owner(),
    closed = await owner({ status: "closing" }),
    foreign = await owner({ scope: "other" });
  const input = {
    productScope: "pact",
    accountId: a.accountId,
    expectedVersion: null,
    authorizationReference: "synthetic-founder-review",
    profile: PROFILE,
  };
  for (const accountId of [closed.accountId, foreign.accountId])
    await assert.rejects(
      withTransaction(pool, (c) => applyReviewedMandate(c, { ...input, accountId })),
      (e) => e.code === "FORBIDDEN",
    );
  await assert.rejects(
    withTransaction(pool, (c) =>
      applyReviewedMandate(c, { ...input, profile: { ...PROFILE, allowedActions: ["approval.commit"] } }),
    ),
    (e) => e.code === "FORBIDDEN",
  );
  await assert.rejects(
    withTransaction(pool, (c) => applyReviewedMandate(c, { ...input, expectedVersion: 10 })),
    (e) => e.code === "STALE_VERSION",
  );
  await assert.rejects(
    withTransaction(pool, async (c) => {
      await applyReviewedMandate(c, input);
      await social.configureDelegation(
        c,
        a.accountId,
        { mode: "agent_decides", allowedKingdomIds: [], expectedVersion: 99 },
        0,
      );
    }),
    (e) => e.code === "OPERATION_CONFLICT",
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM kingdom_mandates WHERE account_id=$1", [a.accountId])).rows[0].n,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM outbox_events WHERE type='operator.mandate.changed.v1' AND payload->>'accountId'=$1",
        [a.accountId],
      )
    ).rows[0].n,
    0,
  );
});
