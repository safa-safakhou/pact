import fs from "node:fs";
import path from "node:path";
import { capacity } from "./scheduler.mjs";

const dir = process.env.PACT_LOCAL_STATE;
if (!dir) throw Error("PACT_LOCAL_STATE_REQUIRED");
// Audit reads safe operational/event files, never private-state.json.
const status = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));
const events = fs
  .readFileSync(path.join(dir, "events.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const receipts = new Map();
for (const event of events.filter((e) => ["receipt", "receipt_recovered"].includes(e.type)))
  receipts.set(event.receipt.commandId, event);
const commits = [...receipts.values()].filter((e) => e.receipt.code === "COMMITTED");
const models = events.filter((e) => e.type === "model_result");
const timings = events.filter((e) => e.type === "turn_timing" && e.completed);
const firstTurns = new Set();
const repeatTimings = timings.filter((event) => {
  if (firstTurns.has(event.actor)) return true;
  firstTurns.add(event.actor);
  return false;
});
const countBy = (items, key) =>
  items.reduce((counts, item) => {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
console.log(
  JSON.stringify(
    {
      ...status,
      stopReason: ["finished", "stopped"].includes(status.status)
        ? events.findLast((e) => e.type === "run_finished")?.stopReason
        : undefined,
      distinctKingdoms: new Set(status.actors.map((a) => a.kingdomId).filter(Boolean)).size,
      turnCounts: countBy(status.actors, (a) => a.turns),
      scheduledTurns: events.filter((e) => e.type === "turn_timing").length,
      successfulTurns: events.filter((e) => e.type === "turn_completed").length,
      failedTurns: events.filter((e) => e.type === "turn_failed").length,
      turnCounterMeaning:
        "actors[].turns is scheduled attempts, including failures; successfulTurns counts completed turns.",
      completedModelResults: models.length,
      modelInputTokens: models.reduce((n, m) => n + (m.inputTokens ?? 0), 0),
      modelOutputTokens: models.reduce((n, m) => n + (m.outputTokens ?? 0), 0),
      uniqueCommittedCommands: commits.length,
      agentCommands: commits.filter((e) => e.role === "agent").length,
      simulatedHumanCommands: commits.filter((e) => e.role?.startsWith("simulated-human")).length,
      automaticOwnerDecisions: commits.filter((e) => e.role === "simulated-human-approval").length,
      commandKinds: countBy(commits, (e) => e.action.kind),
      receiptCodes: countBy([...receipts.values()], (e) => e.receipt.code),
      commandDenials: countBy(
        events.filter((e) => e.type === "action_denied"),
        (e) => e.code,
      ),
      planRejections: countBy(
        events.filter((e) => e.type === "plan_action_rejected"),
        (e) => e.code,
      ),
      turnFailures: countBy(
        events.filter((e) => e.type === "turn_failed"),
        (e) => e.code,
      ),
      modelCapacity: capacity(models.map((e) => e.wallMs)),
      turnCapacity: capacity(timings.map((e) => e.wallMs)),
      repeatTurnCapacity: capacity(repeatTimings.map((e) => e.wallMs)),
      maximumRepeatLatenessMs: Math.max(0, ...repeatTimings.map((e) => e.latenessMs)),
      maximumLatenessMs: Math.max(0, ...timings.map((e) => e.latenessMs)),
      modelValidation: {
        parseSucceeded: models.filter((e) => e.output).length,
        note: "Committed receipt evidence determines successful gameplay; generated text is not a receipt.",
      },
    },
    null,
    2,
  ),
);
