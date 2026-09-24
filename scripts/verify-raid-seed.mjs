import { readFileSync } from "node:fs";
import { verifyRaidReveal } from "@pact/kingdom";

const path = process.argv[2];
if (!path) {
  process.stderr.write("Usage: node scripts/verify-raid-seed.mjs <reveal.json>\n");
  process.exitCode = 2;
} else {
  try {
    const input = JSON.parse(readFileSync(path, "utf8"));
    const proof = {
      raidId: input.raid_id ?? input.raidId,
      rulesVersion: input.rules_version ?? input.rulesVersion,
      seed: input.seed,
      commitment: input.commitment,
      attackerDie: input.attacker_die ?? input.attackerDie,
      defenderDie: input.defender_die ?? input.defenderDie,
      status: input.status ?? "resolved",
    };
    if (!verifyRaidReveal(proof)) throw new Error("commitment or dice mismatch");
    process.stdout.write("PASS: seed commitment and both dice verified\n");
  } catch (error) {
    process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
