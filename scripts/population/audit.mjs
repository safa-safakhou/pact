import fs from "node:fs";

const dir = process.argv[2] ?? "/srv/pact/state/population-20261004";
const status = JSON.parse(fs.readFileSync(`${dir}/status.json`, "utf8"));
const events = fs.readFileSync(`${dir}/events.jsonl`, "utf8").trim().split("\n").map(JSON.parse);
const actors = new Map(status.actors.map((a) => [a.nickname, a]));
const commands = new Map(events.filter((e) => e.type === "action_requested").map((e) => [e.commandId, e]));
const committed = new Map(
  events.filter((e) => e.type === "receipt" && e.receipt.code === "COMMITTED").map((e) => [e.commandId, e]),
);
const observations = events.filter((e) => e.type === "observation"),
  last = new Map(observations.map((e) => [e.actor, e]));
const first = new Map();
for (const e of observations) if (!first.has(e.actor)) first.set(e.actor, e);
const tally = (rows, fn) => {
  const result = {};
  for (const e of rows) {
    const k = fn(e);
    result[k] = (result[k] ?? 0) + 1;
  }
  return result;
};
const reports = events.filter((e) => e.type === "human_report");
const contactPairs = new Set(),
  contracts = new Map(),
  offers = new Map(),
  messages = new Map();
for (const e of observations) {
  for (const c of e.guide.contacts ?? []) contactPairs.add([e.guide.self.kingdomId, c.kingdomId].sort().join(":"));
  for (const c of e.guide.activeSupplyContracts ?? []) contracts.set(c.id, c);
  for (const c of e.guide.openSupplyOffers ?? []) offers.set(c.id, c);
  for (const c of e.conversations ?? []) for (const m of c.messages ?? []) messages.set(m.messageId, m);
}
console.log(
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      status: status.status,
      runId: status.runId,
      startedAt: status.startedAt,
      endsAt: status.endsAt,
      population: {
        uniqueKingdoms: new Set(status.actors.map((a) => a.kingdomId)).size,
        roles: tally(status.actors, (a) => a.role),
        observed: last.size,
      },
      model: {
        jobs: status.modelJobs,
        results: tally(
          events.filter((e) => e.type === "model_result"),
          (e) => (e.ok ? "success" : "failure"),
        ),
        reports: reports.length,
        scriptModelJobs: events.filter((e) => e.type === "model_job" && e.role === "script").length,
      },
      actions: {
        uniqueRequests: commands.size,
        uniqueCommitted: committed.size,
        byKind: tally([...committed.values()], (e) => commands.get(e.commandId)?.action.kind ?? "unknown"),
        byRole: tally([...committed.values()], (e) => commands.get(e.commandId)?.controller ?? e.role),
        denials: events.filter((e) => e.type === "action_denied"),
        blockedActors: status.actors.filter((a) => a.blocked),
      },
      social: {
        observedContactPairs: contactPairs.size,
        observedOffers: offers.size,
        observedActiveContracts: contracts.size,
        observedMessages: messages.size,
      },
      gameMinutesObserved: [...last.entries()].map(([name, e]) => ({
        name,
        role: actors.get(name)?.role,
        minutes: (Number(e.guide.asOfGameTimeMs) - Number(first.get(name).guide.asOfGameTimeMs)) / 60000,
        buildings: e.guide.buildings,
        consequences: e.guide.consequences,
      })),
      lastReports: reports.slice(-10),
      harness: {
        recovery: events.filter((e) => e.type === "operator_recovery"),
        failures: tally(
          events.filter((e) => e.type === "turn_failed"),
          (e) => e.error,
        ),
        latestFailure: events.filter((e) => e.type === "turn_failed").at(-1)?.at,
      },
    },
    null,
    2,
  ),
);
