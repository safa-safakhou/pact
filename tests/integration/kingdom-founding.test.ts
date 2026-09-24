import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { rulesCatalog, wholeResources } from "@pact/domain";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { KingdomService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { OnboardingService } from "@pact/onboarding";
import { Telemetry } from "@pact/telemetry";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../../services/api/src/server.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let onboarding: OnboardingService;
let world: WorldClockService;
let kingdom: KingdomService;
let identity: IdentityService;
let secretBox: AesGcmSecretBox;
let digester: TokenDigester;
let now: Date;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "founding");
  pool = createSchemaPool(connectionString, schema);
  now = new Date();
  onboarding = new OnboardingService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    now: () => new Date(now),
  });
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 17));
  digester = new TokenDigester(Buffer.alloc(32, 19));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.example"]),
    clock: { now: () => new Date(now) },
    digester,
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  // Keep the test's admission window away from a real minute boundary.
  await pool.query(
    "UPDATE world_clocks SET next_tick_due_at = clock_timestamp() + interval '5 minutes', last_heartbeat_at = clock_timestamp() WHERE product_scope = 'pact'",
  );
  kingdom = new KingdomService(pool, {
    productScope: "pact",
    onboarding,
    world,
    ledger: new ResourceLedger("pact"),
  });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function readyDraft(handle: string): Promise<string> {
  const accountId = randomUUID();
  await pool.query(
    `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
     VALUES ($1, 'pact', $2, 'fixture-only', $3, 'terms-v1')`,
    [accountId, `${accountId}@example.test`, now],
  );
  const draft = await onboarding.ensureDraft(accountId);
  await onboarding.updateDraft(accountId, {
    displayName: "Test Kingdom",
    proposedHandle: handle,
    portrait: "portrait.wolf",
    expectedVersion: draft.version,
  });
  await onboarding.recordConnectionCheck(accountId);
  return accountId;
}

async function count(table: string, kingdomId: string): Promise<number> {
  const result = await pool.query(`SELECT count(*)::integer AS count FROM ${table} WHERE kingdom_id = $1`, [kingdomId]);
  return result.rows[0]?.count ?? 0;
}

describe("ranked kingdom founding", () => {
  it("activates concurrently exactly once with founding resources, troops, charges, and first tick", async () => {
    const accountId = await readyDraft(`found_${randomUUID().slice(0, 8)}`);
    expect(await kingdom.getByAccount(accountId)).toBeNull();
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM kingdoms WHERE account_id = $1", [accountId])).rows[0]
        ?.count,
    ).toBe(0);

    const [first, second] = await Promise.all([kingdom.activate(accountId), kingdom.activate(accountId)]);
    expect(second).toEqual(first);
    expect(first.firstTickGameTimeMs).toBe(first.gameTimeMs + 60_000);
    expect(first.tickSequence).toBe("0");
    expect(await count("kingdom_buildings", first.kingdomId)).toBe(7);
    expect(await count("kingdom_builder_slots", first.kingdomId)).toBe(2);
    expect(await count("kingdom_training_queue", first.kingdomId)).toBe(1);
    expect(await count("ledger_kingdoms", first.kingdomId)).toBe(1);
    expect(await count("resource_movements", first.kingdomId)).toBe(3);
    const buildings = await pool.query("SELECT kind, level FROM kingdom_buildings WHERE kingdom_id = $1", [
      first.kingdomId,
    ]);
    expect(buildings.rows.map((row) => row.kind).sort()).toEqual([
      "barracks",
      "farm",
      "hall",
      "market",
      "mine",
      "storehouse",
      "wall",
    ]);
    expect(buildings.rows.every((row) => row.level === 1)).toBe(true);
    const balances = await pool.query<{ resource: string; ordinary_units: string; allowance_units: string }>(
      "SELECT resource, ordinary_units, allowance_units FROM resource_balances WHERE kingdom_id = $1 ORDER BY resource",
      [first.kingdomId],
    );
    expect(balances.rows).toHaveLength(3);
    expect(balances.rows.every((row) => row.ordinary_units === "0")).toBe(true);
    expect(Object.fromEntries(balances.rows.map((row) => [row.resource, row.allowance_units]))).toEqual({
      grain: wholeResources(rulesCatalog.founding.upkeepGrain).toString(),
      iron: wholeResources(rulesCatalog.founding.constructionIron).toString(),
      silver: wholeResources(rulesCatalog.founding.constructionSilver).toString(),
    });
    const troops = await pool.query<{ id: string; type: string; home_guard: boolean; placement: string }>(
      "SELECT id, type, home_guard, placement FROM kingdom_troops WHERE owner_kingdom_id = $1",
      [first.kingdomId],
    );
    expect(troops.rows).toHaveLength(rulesCatalog.founding.homeGuardSpearmen);
    expect(troops.rows.every((row) => row.type === "spearman" && row.home_guard && row.placement === "home")).toBe(
      true,
    );
    expect(troops.rows.every((row) => row.id[14] === "7")).toBe(true);
    const charges = await pool.query(
      "SELECT kind, available, capacity FROM kingdom_charges WHERE kingdom_id = $1 ORDER BY kind",
      [first.kingdomId],
    );
    expect(charges.rows).toEqual([
      {
        kind: "raid",
        available: rulesCatalog.actionLimits.raidCharges,
        capacity: rulesCatalog.actionLimits.raidCharges,
      },
      {
        kind: "scout",
        available: rulesCatalog.actionLimits.scoutCharges,
        capacity: rulesCatalog.actionLimits.scoutCharges,
      },
    ]);
    const baseline = await pool.query(
      "SELECT marked_value_numerator, marked_value_denominator FROM kingdom_score_baselines WHERE kingdom_id = $1",
      [first.kingdomId],
    );
    expect(baseline.rows).toEqual([{ marked_value_numerator: "0", marked_value_denominator: "1" }]);
    const activation = await pool.query(
      "SELECT event_id FROM outbox_events WHERE type = 'kingdom.activated.v1' AND payload->>'kingdomId' = $1",
      [first.kingdomId],
    );
    expect(activation.rows).toEqual([{ event_id: first.activationEventId }]);
  });

  it("reserves handles without renaming and rejects a stale connection check", async () => {
    const handle = `taken_${randomUUID().slice(0, 8)}`;
    const firstAccount = await readyDraft(handle);
    const secondAccount = await readyDraft(handle);
    await kingdom.activate(firstAccount);
    await expect(kingdom.activate(secondAccount)).rejects.toMatchObject({ code: "HANDLE_TAKEN" });
    expect(await kingdom.getByAccount(secondAccount)).toBeNull();

    const staleAccount = await readyDraft(`stale_${randomUUID().slice(0, 8)}`);
    await pool.query("UPDATE kingdom_drafts SET connection_checked_at = $2 WHERE account_id = $1", [
      staleAccount,
      new Date(now.getTime() - 8 * 86_400_000),
    ]);
    await expect(kingdom.activate(staleAccount)).rejects.toMatchObject({ code: "CONNECTION_STALE" });
    expect(await kingdom.getByAccount(staleAccount)).toBeNull();
  });

  it("rolls back every founding write and leaves the draft private on failure", async () => {
    const accountId = await readyDraft(`rollback_${randomUUID().slice(0, 8)}`);
    const beforeLedger = (await pool.query("SELECT count(*)::integer AS count FROM ledger_kingdoms")).rows[0]?.count;
    const beforeEvents = (
      await pool.query("SELECT count(*)::integer AS count FROM outbox_events WHERE type = 'kingdom.activated.v1'")
    ).rows[0]?.count;
    await pool.query(`CREATE FUNCTION fail_founding() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fixture founding failure'; END $$`);
    await pool.query(
      "CREATE TRIGGER fail_founding BEFORE INSERT ON kingdom_buildings FOR EACH ROW EXECUTE FUNCTION fail_founding()",
    );
    try {
      await expect(kingdom.activate(accountId)).rejects.toThrow("fixture founding failure");
    } finally {
      await pool.query("DROP TRIGGER fail_founding ON kingdom_buildings");
      await pool.query("DROP FUNCTION fail_founding()");
    }
    expect(await kingdom.getByAccount(accountId)).toBeNull();
    const draft = await pool.query("SELECT activated_at FROM kingdom_drafts WHERE account_id = $1", [accountId]);
    expect(draft.rows[0]?.activated_at).toBeNull();
    expect((await pool.query("SELECT count(*)::integer AS count FROM ledger_kingdoms")).rows[0]?.count).toBe(
      beforeLedger,
    );
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM outbox_events WHERE type = 'kingdom.activated.v1'"))
        .rows[0]?.count,
    ).toBe(beforeEvents);
  });

  it("prevents raw account deletion from destroying an active kingdom", async () => {
    const accountId = await readyDraft(`erase_${randomUUID().slice(0, 8)}`);
    const active = await kingdom.activate(accountId);
    await expect(pool.query("DELETE FROM accounts WHERE id = $1", [accountId])).rejects.toThrow(
      "ACCOUNT_DELETION_REQUIRES_RETIREMENT",
    );
    expect(await count("ledger_kingdoms", active.kingdomId)).toBe(1);
    expect(await count("kingdom_buildings", active.kingdomId)).toBe(7);
    expect((await pool.query("SELECT 1 FROM kingdoms WHERE id = $1", [active.kingdomId])).rowCount).toBe(1);
  });

  it("requires a human cookie and CSRF for the activation route and scopes reads to the owner", async () => {
    const email = `${randomUUID()}@example.test`;
    const password = "A long test password 123!";
    await identity.signup({ email, password, age18Declared: true, acceptedTermsVersion: "terms-v1" });
    const emailEvent = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
      "SELECT payload FROM outbox_events WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email' ORDER BY id DESC LIMIT 1",
    );
    const payload = emailEvent.rows[0]?.payload;
    if (!payload) throw new Error("Verification fixture missing");
    await identity.verifyEmail(Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8"));
    const draft = await onboarding.ensureDraft(payload.accountId);
    await onboarding.updateDraft(payload.accountId, {
      displayName: "Route Kingdom",
      proposedHandle: `route_${randomUUID().slice(0, 8)}`,
      portrait: "portrait.wolf",
      expectedVersion: draft.version,
    });
    await onboarding.recordConnectionCheck(payload.accountId);
    const session = await identity.login({ email, password, ip: "192.0.2.11", label: "fixture" });
    const dispatcher = new CommandDispatcher({
      pool,
      clock: { now: () => new Date(now) },
      productScope: ProductScopeSchema.parse("pact"),
    });
    const server = buildServer(pool, false, new Telemetry(() => undefined), {
      identity,
      onboarding,
      kingdom,
      dispatcher,
    });
    try {
      expect((await server.inject({ method: "POST", url: "/v1/setup/activate" })).statusCode).toBe(403);
      const cookie = `pact_session=${encodeURIComponent(session.sessionToken)}`;
      expect((await server.inject({ method: "POST", url: "/v1/setup/activate", headers: { cookie } })).statusCode).toBe(
        403,
      );
      const agentToken = randomUUID();
      await pool.query(
        `INSERT INTO sessions(product_scope, account_id, audience, token_hash, expires_at, idle_expires_at, authenticated_at)
         VALUES ('pact', $1, 'agent', $2, $3, $3, $4)`,
        [payload.accountId, digester.digest(agentToken), new Date(now.getTime() + 86_400_000), now],
      );
      const agentResponse = await server.inject({
        method: "POST",
        url: "/v1/setup/activate",
        headers: {
          cookie: `pact_session=${encodeURIComponent(agentToken)}`,
          origin: "https://pact.example",
          "x-csrf-token": session.csrfToken,
        },
      });
      expect(agentResponse.statusCode).toBe(403);
      const activated = await server.inject({
        method: "POST",
        url: "/v1/setup/activate",
        headers: { cookie, origin: "https://pact.example", "x-csrf-token": session.csrfToken },
      });
      expect(activated.statusCode).toBe(200);
      const current = await server.inject({ method: "GET", url: "/v1/kingdom/me", headers: { cookie } });
      expect(current.json().kingdomId).toBe(activated.json().kingdomId);
      expect((await server.inject({ method: "GET", url: "/v1/kingdom/me" })).statusCode).toBe(403);
    } finally {
      await server.close();
    }
  });
});
