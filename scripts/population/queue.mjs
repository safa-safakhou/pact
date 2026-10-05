import fs from "node:fs";
import path from "node:path";

const dir = process.env.PACT_POPULATION_STATE ?? "/srv/pact/state/population-20261004";
const jobs = path.join(dir, "jobs");
const mode = process.argv[2];
if (mode === "claim") {
  let chosen = null;
  if (!fs.existsSync(path.join(dir, "STOP")))
    for (const f of fs
      .readdirSync(jobs)
      .filter((x) => x.endsWith(".job.json"))
      .sort()) {
      const job = JSON.parse(fs.readFileSync(path.join(jobs, f), "utf8"));
      if (
        job.deadline < Date.now() ||
        fs.existsSync(path.join(jobs, `${job.id}.result.json`)) ||
        fs.existsSync(path.join(jobs, `${job.id}.claim`))
      )
        continue;
      if (!chosen || job.createdAt < chosen.createdAt) chosen = job;
    }
  if (chosen) {
    try {
      fs.writeFileSync(path.join(jobs, `${chosen.id}.claim`), new Date().toISOString(), { flag: "wx", mode: 0o600 });
    } catch {
      chosen = null;
    }
  }
  console.log(JSON.stringify(chosen));
} else if (mode === "result") {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > 1000000) throw Error("RESULT_TOO_LARGE");
  }
  const result = JSON.parse(raw);
  if (!/^[0-9a-f-]{36}$/.test(result.id)) throw Error("INVALID_JOB_ID");
  const job = JSON.parse(fs.readFileSync(path.join(jobs, `${result.id}.job.json`), "utf8"));
  if (job.runId !== result.runId) throw Error("RUN_MISMATCH");
  const out = path.join(jobs, `${result.id}.result.json`);
  fs.writeFileSync(`${out}.tmp`, JSON.stringify(result), { mode: 0o600 });
  fs.renameSync(`${out}.tmp`, out);
  console.log(JSON.stringify({ stored: true, id: result.id }));
} else throw Error("MODE_REQUIRED");
