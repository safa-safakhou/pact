import { loadOperatorPreflight } from "./operator-preflight.js";

const path = process.argv[2] ?? process.env.PACT_OPERATOR_REGISTER_FILE;
const preflight = await loadOperatorPreflight(path, process.env.CURRENT_TERMS_VERSION);
process.stdout.write(`${JSON.stringify(preflight.report(), undefined, 2)}\n`);
if (!preflight.registrationEnabled) process.exitCode = 1;
