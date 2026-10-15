import { createPool } from "@pact/db";
import { WorldViewService } from "@pact/kingdom";
import { afterAll, expect, it } from "vitest";
import { design } from "../evaluation/plan.js";
import { evaluationWorld } from "../evaluation/world.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact_test:isolated_fixture@127.0.0.1:55437/pact_test",
  admin = createPool(url);
afterAll(async () => {
  await admin.end();
});
for (const scenario of design.scenarios)
  it(`creates isolated normal founders and exact synthetic inputs for ${scenario.id}`, async () => {
    const left = await evaluationWorld(admin, url, `${scenario.id}:11:baseline`),
      right = await evaluationWorld(admin, url, `${scenario.id}:11:attention`);
    try {
      expect(left.schema).not.toBe(right.schema);
      const a = left.players[0],
        b = right.players[0];
      if (!a || !b) throw Error("fixture");
      const l = await new WorldViewService(left.pool, "pact").readSelf(a.accountId),
        r = await new WorldViewService(right.pool, "pact").readSelf(b.accountId);
      expect(l?.balances).toEqual(r?.balances);
      expect(l?.buildings).toEqual(r?.buildings);
      expect(
        (
          await left.pool.query(
            "SELECT count(*)::int n FROM kingdom_troops WHERE home_guard=true AND owner_kingdom_id=$1",
            [a.kingdomId],
          )
        ).rows[0].n,
      ).toBe(8);
      await left.pool.query("UPDATE kingdoms SET ambition='synthetic left only' WHERE id=$1", [a.kingdomId]);
      expect(
        (await right.pool.query("SELECT ambition FROM kingdoms WHERE id=$1", [b.kingdomId])).rows[0].ambition,
      ).not.toBe("synthetic left only");
      expect(l?.balances.iron.ordinaryUnits).toBe(
        ["overflow", "bad_trade"].includes(scenario.id)
          ? "360000"
          : ["later_development", "ceiling_control"].includes(scenario.id)
            ? "360000"
            : scenario.id === "complementary_needs"
              ? "60000"
              : "0",
      );
    } finally {
      await left.close();
      await right.close();
    }
  });
