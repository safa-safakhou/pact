import { createPool } from "@pact/db";
import { afterAll, expect, it } from "vitest";
import { playbackRecordedScenario, recordScenario, scenarioBranch } from "../evaluation/recording.js";
import { playbackScenario, playScenario, readScenarioOutcome, scenarioEvents } from "../evaluation/scenarios.js";
import { evaluationWorld } from "../evaluation/world.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5438/pact_test",
  admin = createPool(url);
afterAll(async () => {
  await admin.end();
});
function cedar(w: Awaited<ReturnType<typeof evaluationWorld>>) {
  const actor = w.players[0];
  if (!actor) throw Error("MISSING_CEDAR");
  return actor;
}
it("admits Cedar reinforcements before the five-minute lock, while fulfilled help can coexist with a lost battle", async () => {
  const w = await evaluationWorld(admin, url, "threat-help:11:baseline");
  try {
    const result = await playScenario(w, "accept");
    expect(result.resolutionMinutes).toBe(20);
    expect(result.declarationToResolutionMinutes).toBe(21);
    expect(result.lockMinutesBeforeResolution).toBe(5);
    expect(result.visitorsBeforeLock).toBe(8);
    const outcome = await readScenarioOutcome(w, cedar(w));
    expect(outcome.garrisonFulfilment).toBe("fulfilled");
    expect(outcome.defenseResult).toBe("lost");
    expect(outcome.motiveProven).toBe(false);
    expect(outcome.obligations).toMatchObject({ due: 1, fulfilled: 1, defaulted: 0 });
    expect(outcome.losses.ownTroops).toBeGreaterThan(0);
    expect(outcome.coverage.opponentPrivateState).toBe(false);
    expect(result.buildingsIntact).toBe(true);
    const events = await scenarioEvents(w, cedar(w));
    expect(events.events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        "raid.declared.v1",
        "garrison.contract.activated.v1",
        "raid.resolved.v1",
        "garrison.contract.closed.v1",
      ]),
    );
    expect(JSON.stringify(events)).not.toContain("password");
    expect((await w.pool.query("SELECT * FROM envoy_runs")).rowCount).toBe(0);
    expect(outcome.sourceRefs.length).toBeGreaterThan(0);
    const recording = await recordScenario(w, cedar(w));
    expect(playbackRecordedScenario(JSON.parse(JSON.stringify(recording)))).toEqual(outcome);
    expect(() => playbackRecordedScenario({ ...recording, privateMessages: "PRIVATE" })).toThrow();
    const branch = await scenarioBranch(admin, url, recording, "attention");
    try {
      expect(branch.schema).not.toBe(w.schema);
      expect(branch.branch.kind).toBe("fresh_fixture_branch");
      expect((await branch.pool.query("SELECT * FROM command_receipts")).rowCount).toBe(0);
    } finally {
      await branch.close();
    }
    const before = (await w.pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0].n;
    expect(await playbackScenario(w, cedar(w))).toEqual(outcome);
    expect((await w.pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0].n).toBe(before);
  } finally {
    await w.close();
  }
});
it("records early recall as a default without assigning motive or fabricating fulfilment", async () => {
  const w = await evaluationWorld(admin, url, "early-recall:11:baseline");
  try {
    await playScenario(w, "accept");
    const o = await readScenarioOutcome(w, cedar(w));
    expect(o.garrisonFulfilment).toBe("defaulted");
    expect(o.obligations.defaulted).toBe(1);
    expect(o.motiveProven).toBe(false);
  } finally {
    await w.close();
  }
});
it("measures real food pressure and a host default separately from accepting assistance", async () => {
  const w = await evaluationWorld(admin, url, "food-pressure:11:baseline");
  try {
    await playScenario(w, "accept");
    const o = await readScenarioOutcome(w, cedar(w));
    expect(o.garrisonFulfilment).toBe("defaulted");
    expect(o.upkeep.shortageMinutes).toBeGreaterThan(0);
    expect(o.upkeep.coveredMinutes).toBe(62);
  } finally {
    await w.close();
  }
});
for (const id of ["unneeded-help", "silence-valid"])
  it(`permits waiting without requiring a message for ${id}`, async () => {
    const w = await evaluationWorld(admin, url, `${id}:11:baseline`);
    try {
      const result = await playScenario(w, "wait");
      const o = await readScenarioOutcome(w, cedar(w));
      expect(result.requiresMessage).toBe(false);
      expect(o.obligations.due).toBe(0);
      expect(o.defenseResult).toBe("not_applicable");
      expect(o.coverage.validWait).toBe(true);
      expect((await w.pool.query("SELECT * FROM envoy_runs")).rowCount).toBe(0);
    } finally {
      await w.close();
    }
  });
it("keeps costly bond/payment conditions visible, no atomic invented supply contract or private peer text", async () => {
  const w = await evaluationWorld(admin, url, "costly-help:11:baseline");
  try {
    const r = await playScenario(w, "accept");
    expect(r.bondReserved).toBe("30000");
    expect((await w.pool.query("SELECT * FROM supply_contracts")).rowCount).toBe(0);
    const o = await readScenarioOutcome(w, cedar(w));
    expect(JSON.stringify(o)).not.toMatch(/password|eligibleUnitIds|privateMessage|motive.*hostile/);
    await expect(readScenarioOutcome(w, { accountId: "foreign", kingdomId: cedar(w).kingdomId })).rejects.toThrow(
      "ACTOR_NOT_IN_WORLD",
    );
  } finally {
    await w.close();
  }
});
