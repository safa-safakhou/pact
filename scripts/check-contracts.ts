import { readFile } from "node:fs/promises";
import * as schemas from "../packages/contracts/src/json-schema.js";
import { checkPublishedContracts } from "./lib/contract-guard.js";

const published = JSON.parse(
  await readFile(new URL("../docs/architecture/published-contracts.json", import.meta.url), "utf8"),
) as Record<string, string>;
checkPublishedContracts(published, schemas);
process.stdout.write(`PASS: ${Object.keys(published).length} published v1 schemas unchanged\n`);
