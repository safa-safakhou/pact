import { readFileSync } from "node:fs";
import { offlineReport } from "./evaluation/agent-society.js";
import { evaluateCollections } from "./evaluation/collections.js";

// Deterministic synthetic stdout only. No implicit scheduling, provider key or network access.
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === "--collection-observations"))
  throw new Error("INVALID_EVALUATION_ARGUMENTS");
const report = args.length
  ? { society: offlineReport(), collections: evaluateCollections(JSON.parse(readFileSync(args[1] ?? "", "utf8"))) }
  : offlineReport();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
