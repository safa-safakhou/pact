import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { hourlyRatePerMinute, wholeResources } from "@pact/domain";
import { ResourceLedger } from "@pact/ledger";
import { type TickContext, WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const start = Date.parse("2026-09-23T00:00:00.000Z");
let admin: Pool;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "resource_ledger");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function founded(scope: string): Promise<{ ledger: ResourceLedger; kingdomId: string }> {
  const ledger = new ResourceLedger(scope);
  const kingdomId = randomUUID();
  await withTransaction(pool, (client) => ledger.initializeKingdom(client, kingdomId, start));
  return { ledger, kingdomId };
}

function tick(scope: string, gameTimeMs: number): TickContext {
  return { productScope: scope, sequence: 1n, gameTimeMs, dueAt: new Date() };
}

describe("resource ledger and provenance", () => {
  it("applies harvest changes to new production only, including the exact week boundary", async () => {
    const scope = "ledger_harvest_boundaries";
    const { ledger, kingdomId } = await founded(scope);
    let grain = 0n,
      iron = 0n,
      silver = 0n;
    const weekMilliseconds = 7 * 24 * 60 * 60 * 1000;
    const produced = [300n, 300n, 270n, 240n, 240n, 300n];
    // Explicit season-week input: automatic season scheduling belongs to PACT-069.
    for (let week = 1; week < 6; week++) {
      const boundary = start + week * weekMilliseconds;
      for (const [time, selectedWeek] of [
        [boundary - 60000, week],
        [boundary, week + 1],
      ]) {
        if (time === undefined || selectedWeek === undefined) throw new Error("Missing harvest case");
        await withTransaction(pool, (client) => ledger.settleProductionMinute(client, tick(scope, time), selectedWeek));
        grain += produced[selectedWeek - 1] ?? 0n;
        iron += 200n;
        silver += 100n;
        for (const [resource, expected] of [
          ["grain", grain],
          ["iron", iron],
          ["silver", silver],
        ] as const) {
          expect(
            (await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, resource))).ordinary,
          ).toBe(expected);
        }
        // Replaying the same boundary cannot multiply stock or add production.
        await withTransaction(pool, (client) => ledger.settleProductionMinute(client, tick(scope, time), selectedWeek));
        expect((await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "grain"))).ordinary).toBe(
          grain,
        );
      }
    }
  });

  it("publishes production and grant boundary effects only with the atomic world tick", async () => {
    const scope = "ledger_world_tick";
    const ledger = new ResourceLedger(scope);
    const world = new WorldClockService(pool, scope, {
      boundaries_and_completions: (client, context) => ledger.expireFoundingAllowances(client, context),
      production: (client, context) => ledger.settleProductionMinute(client, context, 1),
      upkeep: async () => {
        throw new Error("SIMULATED_UPKEEP_FAILURE");
      },
    });
    const initial = await world.bootstrap();
    const kingdomId = randomUUID();
    await withTransaction(pool, (client) => ledger.initializeKingdom(client, kingdomId, initial.gameTimeMs));
    const token = await world.acquireLease("ledger-tick-worker");
    await pool.query(
      `UPDATE world_clocks SET next_tick_due_at = clock_timestamp() - interval '1 second'
       WHERE product_scope = $1`,
      [scope],
    );
    await expect(world.advance("ledger-tick-worker", token ?? "")).rejects.toThrow("SIMULATED_UPKEEP_FAILURE");
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "iron"))).ordinary).toBe(0n);
    expect((await pool.query("SELECT * FROM world_ticks WHERE product_scope = $1", [scope])).rowCount).toBe(0);
    const recovered = new WorldClockService(pool, scope, {
      boundaries_and_completions: (client, context) => ledger.expireFoundingAllowances(client, context),
      production: (client, context) => ledger.settleProductionMinute(client, context, 1),
    });
    expect((await recovered.advance("ledger-tick-worker", token ?? "")).kind).toBe("committed");
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "iron"))).ordinary).toBe(
      200n,
    );
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "grain"))).ordinary).toBe(
      300n,
    );
    expect((await pool.query("SELECT * FROM world_ticks WHERE product_scope = $1", [scope])).rowCount).toBe(1);
  });

  it("creates restricted grants, records exact production, overflow and grant expiry", async () => {
    const { ledger, kingdomId } = await founded("ledger_production");
    const initial = await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "grain"));
    expect(initial.ordinary).toBe(0n);
    expect(initial.allowance).toBe(wholeResources(80));
    expect(initial.storageCap).toBe(wholeResources(600));
    expect(initial.productionPerMinute).toBe(hourlyRatePerMinute(30));

    await withTransaction(pool, (client) =>
      ledger.settleProductionMinute(client, tick("ledger_production", start + 60_000), 4),
    );
    await withTransaction(pool, (client) =>
      ledger.settleProductionMinute(client, tick("ledger_production", start + 60_000), 4),
    );
    const after = await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "grain"));
    expect(after.ordinary).toBe(240n);
    const iron = await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "iron"));
    expect(iron.ordinary).toBe(200n);

    const credit = await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId,
        resource: "grain",
        amount: wholeResources(700),
        operationKey: "large-credit",
        reason: "synthetic_import",
        gameTimeMs: start + 60_000,
      }),
    );
    expect(credit.ordinaryDelta + credit.overflow).toBe(wholeResources(700));
    expect(credit.ordinaryAfter).toBe(wholeResources(600));
    const replay = await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId,
        resource: "grain",
        amount: wholeResources(700),
        operationKey: "large-credit",
        reason: "synthetic_import",
        gameTimeMs: start + 60_000,
      }),
    );
    expect(replay).toEqual(credit);
    await expect(
      withTransaction(pool, (client) =>
        ledger.creditOrdinary(client, {
          kingdomId,
          resource: "grain",
          amount: 1n,
          operationKey: "large-credit",
          reason: "synthetic_import",
          gameTimeMs: start + 60_000,
        }),
      ),
    ).rejects.toThrow("LEDGER_IDEMPOTENCY_CONFLICT");

    const expiry = start + 7 * 24 * 60 * 60 * 1000;
    await withTransaction(pool, (client) => ledger.expireFoundingAllowances(client, tick("ledger_production", expiry)));
    await withTransaction(pool, (client) => ledger.expireFoundingAllowances(client, tick("ledger_production", expiry)));
    const expired = await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "grain"));
    expect(expired.allowance).toBe(0n);
    expect(expired.ordinary).toBe(wholeResources(600));
    const losses = await pool.query<{ allowance_delta: string }>(
      "SELECT allowance_delta FROM resource_movements WHERE product_scope = 'ledger_production' AND resource = 'grain' AND reason = 'grant_expiry'",
    );
    expect(losses.rows).toEqual([{ allowance_delta: (-wholeResources(80)).toString() }]);
  });

  it("prevents concurrent ordinary overspend and keeps allowances out of trade and bonds", async () => {
    const { ledger, kingdomId } = await founded("ledger_concurrency");
    await expect(
      withTransaction(pool, (client) =>
        ledger.debit(client, {
          kingdomId,
          resource: "iron",
          amount: 1n,
          purpose: "trade",
          operationKey: "trade-with-grant",
          gameTimeMs: start,
        }),
      ),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    await expect(
      withTransaction(pool, (client) =>
        ledger.lockBond(client, {
          kingdomId,
          resource: "iron",
          amount: 1n,
          operationKey: "bond-with-grant",
          gameTimeMs: start,
        }),
      ),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId,
        resource: "iron",
        amount: wholeResources(10),
        operationKey: "seed-ordinary",
        reason: "synthetic_import",
        gameTimeMs: start,
      }),
    );
    const spends = await Promise.allSettled(
      ["a", "b"].map((key) =>
        withTransaction(pool, (client) =>
          ledger.debit(client, {
            kingdomId,
            resource: "iron",
            amount: wholeResources(8),
            purpose: "trade",
            operationKey: `trade-${key}`,
            gameTimeMs: start,
          }),
        ),
      ),
    );
    expect(spends.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(spends.filter((result) => result.status === "rejected")).toHaveLength(1);
    const balance = await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "iron"));
    expect(balance.ordinary).toBe(wholeResources(2));
    expect(balance.allowance).toBe(wholeResources(200));
    const bond = await withTransaction(pool, (client) =>
      ledger.lockBond(client, {
        kingdomId,
        resource: "iron",
        amount: wholeResources(2),
        operationKey: "bond-funded",
        gameTimeMs: start,
      }),
    );
    expect(bond.ordinaryDelta + bond.lockedDelta).toBe(0n);
    expect(bond.lockedAfter).toBe(wholeResources(2));
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId,
        resource: "iron",
        amount: wholeResources(600),
        operationKey: "fill-after-bond",
        reason: "synthetic_import",
        gameTimeMs: start,
      }),
    );
    const returned = await withTransaction(pool, (client) =>
      ledger.releaseBond(client, {
        kingdomId,
        resource: "iron",
        amount: wholeResources(2),
        operationKey: "bond-return",
        gameTimeMs: start,
      }),
    );
    expect(returned.lockedAfter).toBe(0n);
    expect(returned.overflow).toBe(wholeResources(2));
  });

  it("tracks construction/training provenance and cannot refund grants as ordinary stock", async () => {
    const { ledger, kingdomId } = await founded("ledger_costs");
    const construction = await withTransaction(pool, (client) =>
      ledger.payCost(client, {
        kingdomId,
        resource: "iron",
        kind: "construction",
        amount: wholeResources(40),
        operationKey: "farm-two",
        gameTimeMs: start,
      }),
    );
    expect(construction.ordinaryPaid).toBe(0n);
    expect(construction.allowancePaid).toBe(wholeResources(40));
    const refund = await withTransaction(pool, (client) =>
      ledger.cancelCost(client, kingdomId, construction.id, start),
    );
    expect(refund.ordinaryDelta).toBe(0n);
    expect(refund.allowanceDelta).toBe(wholeResources(20));
    expect(refund.cancellationLoss).toBe(wholeResources(20));
    expect(
      await withTransaction(pool, (client) => ledger.cancelCost(client, kingdomId, construction.id, start)),
    ).toEqual(refund);

    await expect(
      withTransaction(pool, (client) =>
        ledger.payCost(client, {
          kingdomId,
          resource: "iron",
          kind: "training",
          amount: wholeResources(10),
          operationKey: "train-spearman",
          gameTimeMs: start,
        }),
      ),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId,
        resource: "iron",
        amount: wholeResources(10),
        operationKey: "earned-iron",
        reason: "synthetic_import",
        gameTimeMs: start,
      }),
    );
    const training = await withTransaction(pool, (client) =>
      ledger.payCost(client, {
        kingdomId,
        resource: "iron",
        kind: "training",
        amount: wholeResources(10),
        operationKey: "train-spearman",
        gameTimeMs: start,
      }),
    );
    expect(training.ordinaryPaid).toBe(wholeResources(10));
    expect(training.allowancePaid).toBe(0n);
    const trainingRefund = await withTransaction(pool, (client) =>
      ledger.cancelCost(client, kingdomId, training.id, start),
    );
    expect(trainingRefund.ordinaryDelta).toBe(wholeResources(8));
    expect(trainingRefund.allowanceDelta).toBe(0n);
    expect(trainingRefund.cancellationLoss).toBe(wholeResources(2));
    const installed = await withTransaction(pool, (client) =>
      ledger.payCost(client, {
        kingdomId,
        resource: "silver",
        kind: "construction",
        amount: wholeResources(20),
        operationKey: "installed-farm-two",
        gameTimeMs: start,
      }),
    );
    const completed = await withTransaction(pool, (client) =>
      ledger.completeCost(client, kingdomId, installed.id, start + 60_000),
    );
    expect(completed.status).toBe("installed");
    expect(completed.allowancePaid).toBe(wholeResources(20));
    await expect(
      withTransaction(pool, (client) => ledger.cancelCost(client, kingdomId, installed.id, start + 60_000)),
    ).rejects.toThrow("COST_ALREADY_SETTLED");
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId,
        resource: "iron",
        amount: wholeResources(2),
        operationKey: "earned-more-iron",
        reason: "synthetic_import",
        gameTimeMs: start,
      }),
    );
    const batch = await withTransaction(pool, (client) =>
      ledger.payCost(client, {
        kingdomId,
        resource: "iron",
        kind: "training",
        amount: wholeResources(10),
        operationKey: "train-batch",
        gameTimeMs: start,
      }),
    );
    const consumed = await withTransaction(pool, (client) =>
      ledger.consumeTrainingCost(client, {
        kingdomId,
        costId: batch.id,
        ordinaryUnits: wholeResources(4),
        operationKey: "first-completions",
        gameTimeMs: start + 60_000,
      }),
    );
    expect(consumed.ordinaryRemaining).toBe(wholeResources(6));
    const replay = await withTransaction(pool, (client) =>
      ledger.consumeTrainingCost(client, {
        kingdomId,
        costId: batch.id,
        ordinaryUnits: wholeResources(4),
        operationKey: "first-completions",
        gameTimeMs: start + 60_000,
      }),
    );
    expect(replay.ordinaryRemaining).toBe(wholeResources(6));
    const partialRefund = await withTransaction(pool, (client) =>
      ledger.cancelCost(client, kingdomId, batch.id, start + 60_000),
    );
    expect(partialRefund.ordinaryDelta).toBe((wholeResources(6) * 80n) / 100n);
    expect(partialRefund.cancellationLoss).toBe((wholeResources(6) * 20n) / 100n);
  });

  it("records cap reduction and does not restore expired grant funds through cancellation", async () => {
    const { ledger, kingdomId } = await founded("ledger_caps");
    const cost = await withTransaction(pool, (client) =>
      ledger.payCost(client, {
        kingdomId,
        resource: "silver",
        kind: "construction",
        amount: wholeResources(30),
        operationKey: "market-two",
        gameTimeMs: start,
      }),
    );
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId,
        resource: "silver",
        amount: wholeResources(600),
        operationKey: "fill-storehouse",
        reason: "synthetic_import",
        gameTimeMs: start,
      }),
    );
    const loss = await withTransaction(pool, (client) =>
      ledger.configureEconomy(client, {
        kingdomId,
        resource: "silver",
        storageCapUnits: wholeResources(500),
        productionPerMinuteUnits: hourlyRatePerMinute(15),
        operationKey: "storehouse-shrink",
        gameTimeMs: start,
      }),
    );
    expect(loss).toBe(wholeResources(100));
    const expiry = start + 7 * 24 * 60 * 60 * 1000;
    await withTransaction(pool, (client) => ledger.expireFoundingAllowances(client, tick("ledger_caps", expiry)));
    const refund = await withTransaction(pool, (client) => ledger.cancelCost(client, kingdomId, cost.id, expiry));
    expect(refund.allowanceDelta).toBe(0n);
    expect(refund.cancellationLoss).toBe(wholeResources(30));
    expect(refund.ordinaryDelta).toBe(0n);
    const balance = await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "silver"));
    expect(balance.ordinary).toBe(wholeResources(500));
    expect(balance.allowance).toBe(0n);
  });
});
