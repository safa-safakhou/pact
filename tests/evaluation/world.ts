import { createHash } from "node:crypto";
import { createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { hourlyRatePerMinute, rulesCatalog, wholeResources } from "@pact/domain";
import { KingdomService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { OnboardingService } from "@pact/onboarding";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { independentPlan } from "./plan.js";
/** Disposable test-only worlds. Never takes a live schema or account selector. */
export async function evaluationWorld(admin: Pool, url: string, replicaId: string) {
  const target = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/pact_test")
    throw Error("ISOLATED_TEST_DATABASE_REQUIRED");
  const replica = independentPlan().find((r) => r.replicaId === replicaId);
  if (!replica) throw Error("UNPLANNED_REPLICA");
  const schema = await createTestSchema(admin, "evaluation"),
    pool = createSchemaPool(url, schema);
  const close = async () => {
    await pool.end();
    await dropTestSchema(admin, schema);
  };
  try {
    const world = new WorldClockService(pool, "pact");
    await world.bootstrap();
    await pool.query(
      "UPDATE world_clocks SET committed_game_time_ms=0,tick_sequence=0,next_tick_due_at=clock_timestamp()+interval '10 minutes' WHERE product_scope='pact'",
    );
    const onboarding = new OnboardingService(pool, {
        productScope: "pact",
        currentTermsVersion: "terms-v1",
        now: () => new Date(),
      }),
      ledger = new ResourceLedger("pact"),
      kingdom = new KingdomService(pool, { productScope: "pact", onboarding, world, ledger });
    const players = [];
    for (let i = 0; i < 2; i++) {
      // Same logical identity/initial inputs across arms, isolated by schema; never a real account.
      const raw = createHash("sha256").update(`${replica.scenario}:${replica.seed}:${i}`).digest("hex"),
        accountId = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
      await pool.query(
        "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture-only',clock_timestamp(),'terms-v1')",
        [accountId, `${accountId}@example.test`],
      );
      const draft = await onboarding.ensureDraft(accountId);
      await onboarding.updateDraft(accountId, {
        displayName: `Evaluation ${i}`,
        proposedHandle: `eval_${raw.slice(0, 10)}`,
        portrait: "portrait.wolf",
        expectedVersion: draft.version,
      });
      await onboarding.recordConnectionCheck(accountId);
      const activated = await kingdom.activate(accountId);
      players.push({ accountId, kingdomId: activated.kingdomId });
      await pool.query(
        "INSERT INTO kingdom_mandates(product_scope,account_id,allowed_actions,resource_limits) VALUES('pact',$1,ARRAY['building.queue','supply.sign','contact.request','message.send.contact'],$2)",
        [accountId, Object.fromEntries(["iron", "silver", "grain"].map((r) => [r, wholeResources(1000).toString()]))],
      );
      const later = ["later_development", "ceiling_control"].includes(replica.scenario);
      if (later)
        await pool.query(
          "UPDATE kingdom_buildings SET level=CASE kind WHEN 'hall' THEN 2 WHEN 'farm' THEN 3 WHEN 'barracks' THEN 3 WHEN 'storehouse' THEN 2 ELSE 1 END WHERE kingdom_id=$1",
          [activated.kingdomId],
        );
      await withTransaction(pool, async (c) => {
        for (const resource of ["iron", "silver", "grain"] as const) {
          if (later) {
            const level = resource === "grain" ? 3 : 1;
            const row = rulesCatalog.levels[level - 1],
              storage = rulesCatalog.levels[1];
            if (!row || !storage) throw Error("RULES_CHANGED");
            await ledger.configureEconomy(c, {
              kingdomId: activated.kingdomId,
              resource,
              storageCapUnits: wholeResources(storage.storagePerResource),
              productionPerMinuteUnits: hourlyRatePerMinute(
                resource === "iron" ? row.ironPerHour : resource === "silver" ? row.silverPerHour : row.grainPerHour,
              ),
              operationKey: `fixture-economy:${resource}`,
              gameTimeMs: 0,
            });
          }
          const balance = await ledger.readBalance(c, activated.kingdomId, resource);
          const surplus = (i === 0 && resource === "iron") || (i === 1 && resource === "silver");
          const amount = later
            ? wholeResources(resource === "iron" ? 600 : resource === "silver" ? 300 : 100)
            : surplus && ["overflow", "bad_trade"].includes(replica.scenario)
              ? balance.storageCap
              : surplus && replica.scenario === "complementary_needs"
                ? wholeResources(100)
                : 0n;
          if (amount > 0n)
            await ledger.creditOrdinary(c, {
              kingdomId: activated.kingdomId,
              resource,
              amount,
              operationKey: `fixture-stock:${resource}`,
              reason: "fixture",
              gameTimeMs: 0,
            });
        }
      });
    }
    return { pool, schema, players, replica, close };
  } catch (e) {
    await close();
    throw e;
  }
}
