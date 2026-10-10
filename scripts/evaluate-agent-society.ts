import { offlineReport } from "./evaluation/agent-society.js";

// Deterministic synthetic stdout only. No implicit scheduling, provider key or network access.
process.stdout.write(`${JSON.stringify(offlineReport(), null, 2)}\n`);
