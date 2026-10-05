import fs from "node:fs";

const dir = process.argv[2] ?? "/srv/pact/state/population-20261004";
const s = JSON.parse(fs.readFileSync(`${dir}/status.json`, "utf8"));
const events = fs
  .readFileSync(`${dir}/events.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map((x) => JSON.parse(x));
const count = (key, filter = () => true) =>
  Object.fromEntries(
    [...new Set(events.filter(filter).map((x) => x[key]))].map((k) => [
      k,
      events.filter((x) => filter(x) && x[key] === k).length,
    ]),
  );
const receipts = events.filter((e) => e.type === "receipt");
console.log(
  JSON.stringify(
    {
      runId: s.runId,
      status: s.status,
      startedAt: s.startedAt,
      endsAt: s.endsAt,
      modelJobs: s.modelJobs,
      provisioned: s.actors.filter((a) => a.kingdomId).length,
      luna: s.actors
        .filter((a) => a.role === "luna")
        .map(({ nickname, wave, failures, blocked }) => ({ nickname, wave, failures, blocked })),
      bots: {
        count: s.actors.filter((a) => a.role === "script").length,
        minRound: Math.min(...s.actors.filter((a) => a.role === "script").map((a) => a.round)),
        maxRound: Math.max(...s.actors.filter((a) => a.role === "script").map((a) => a.round)),
      },
      events: count("type"),
      receiptCodes: receipts.reduce((o, e) => {
        o[e.receipt.code] = (o[e.receipt.code] ?? 0) + 1;
        return o;
      }, {}),
      recentErrors: events.filter((e) => ["turn_failed", "runner_failed", "action_blocked"].includes(e.type)).slice(-8),
      lastReports: events.filter((e) => e.type === "human_report").slice(-2),
    },
    null,
    2,
  ),
);
