import { execFileSync, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [operation, root] = process.argv.slice(2);
if (!root || !["boot", "status", "launch", "watch", "snapshot", "park"].includes(operation))
  throw Error("Usage: control.mjs boot|status|launch|watch|snapshot|park <private-state-directory>");
const config = JSON.parse(readFileSync(resolve(root, "config.json"), "utf8"));
if (config.root !== resolve(root) || !/^local-four-\d{8}-[a-f0-9]{8}$/.test(config.id))
  throw Error("Local world identity mismatch");
const stateFile = resolve(root, "window.json");
const readState = () => JSON.parse(readFileSync(stateFile, "utf8"));
function saveState(value) {
  const temp = stateFile + ".next";
  writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(temp, stateFile);
}
const environment = (kind) => ({ ...process.env, ...(kind === "pact" ? config.pactEnv : config.fleetEnv) });
function run(kind, args) {
  return execFileSync(config.node, args, {
    cwd: config[`${kind}Repo`],
    env: environment(kind),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
function start(name, kind, args, extra = {}) {
  const pidFile = resolve(root, `${name}.pid`);
  if (existsSync(pidFile)) {
    try {
      process.kill(Number(readFileSync(pidFile, "utf8")), 0);
      return;
    } catch {}
  }
  const log = openSync(resolve(root, "logs", `${name}.log`), "a", 0o600);
  const child = spawn(config.node, args, {
    cwd: config[`${kind}Repo`],
    env: { ...environment(kind), ...extra },
    detached: true,
    stdio: ["ignore", log, log],
  });
  writeFileSync(pidFile, String(child.pid), { mode: 0o600 });
  child.unref();
}
async function ready(url) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Local service readiness failed: " + url);
}
async function fleet() {
  process.chdir(config.fleetRepo);
  Object.assign(process.env, environment("fleet"));
  return (await import(pathToFileURL(resolve(config.fleetRepo, "dist/server/runtime.js")).href)).runtime();
}
async function gamePool() {
  const { createPool } = await import(pathToFileURL(resolve(config.pactRepo, "packages/db/dist/index.js")).href);
  return createPool(config.pactEnv.DATABASE_URL);
}
async function status() {
  const r = await fleet();
  const game = await gamePool();
  try {
    const groups = (
      await r.pool.query(
        "SELECT c.id,c.name,c.state,p.profile_id,c.model,c.budget,count(a.id)::int actors FROM cohorts c JOIN cohort_engine_profiles p ON p.cohort_id=c.id JOIN agents a ON a.cohort_id=c.id GROUP BY c.id,p.profile_id ORDER BY c.name",
      )
    ).rows;
    const counts = (
      await r.pool.query(
        "SELECT (SELECT count(*)::int FROM turns) turns,(SELECT count(*)::int FROM compute_ledger) executions,(SELECT count(*)::int FROM compute_ledger WHERE status='unknown') unknown",
      )
    ).rows[0];
    const clock = (
      await game.query(
        "SELECT status,tick_sequence::text,committed_game_time_ms::text FROM world_clocks WHERE product_scope=$1",
        ["pact"],
      )
    ).rows[0];
    const achievements = (
      await game.query(`SELECT
      (SELECT count(*)::int FROM kingdoms) kingdoms,
      (SELECT count(*)::int FROM building_instructions WHERE state='completed') completedBuildings,
      (SELECT count(*)::int FROM social_contacts) contacts,
      (SELECT count(*)::int FROM direct_messages) messages,
      (SELECT count(*)::int FROM supply_contracts) supplyContracts`)
    ).rows[0];
    for (const group of groups) {
      const kingdomIds = (
        await r.pool.query("SELECT kingdom_id FROM agents WHERE cohort_id=$1 ORDER BY ordinal", [group.id])
      ).rows.map((row) => row.kingdom_id);
      group.compute = (
        await r.pool.query(
          `SELECT count(*)::int requests,coalesce(sum(tokens),0)::text reserved_tokens,coalesce(sum(input_tokens),0)::text reported_input_tokens,coalesce(sum(output_tokens),0)::text reported_output_tokens,count(*) FILTER(WHERE status='unknown')::int unknown FROM compute_ledger WHERE cohort_id=$1`,
          [group.id],
        )
      ).rows[0];
      group.turns = (
        await r.pool.query(
          `SELECT count(*)::int attempts,count(*) FILTER(WHERE state='finished')::int finished,coalesce(sum(actions),0)::int committed_actions FROM turns WHERE cohort_id=$1`,
          [group.id],
        )
      ).rows[0];
      group.cognition = (
        await r.pool.query(
          `SELECT
        (SELECT count(*)::int FROM cognitive_episodes WHERE cohort_id=$1 AND kind='interpretation') legacy_interpretations,
        (SELECT count(*)::int FROM cognitive_updates u JOIN agents a ON a.id=u.agent_id WHERE a.cohort_id=$1) legacy_updates,
        (SELECT count(*)::int FROM continuity_updates WHERE cohort_id=$1) modern_updates,
        (SELECT count(*)::int FROM turn_events WHERE cohort_id=$1 AND label='Debug: Laya recall request') helper_requests`,
          [group.id],
        )
      ).rows[0];
      group.world = (
        await game.query(
          `SELECT
        (SELECT count(*)::int FROM building_instructions WHERE kingdom_id=ANY($1::uuid[]) AND state='completed') completed_buildings,
        (SELECT count(*)::int FROM building_instructions WHERE kingdom_id=ANY($1::uuid[]) AND state IN('waiting','active')) pending_buildings,
        (SELECT count(*)::int FROM direct_messages WHERE sender_kingdom_id=ANY($1::uuid[])) sent_messages,
        (SELECT count(*)::int FROM social_contacts WHERE kingdom_a=ANY($1::uuid[]) OR kingdom_b=ANY($1::uuid[])) contact_participations,
        (SELECT count(*)::int FROM supply_contracts WHERE kingdom_a=ANY($1::uuid[]) OR kingdom_b=ANY($1::uuid[])) contract_participations,
        (SELECT coalesce(sum(delivered_units),0)::text FROM supply_installments WHERE recipient_kingdom_id=ANY($1::uuid[])) delivered_supply_units`,
          [kingdomIds],
        )
      ).rows[0];
      group.resources = (
        await game.query(
          `SELECT resource,sum(ordinary_units)::text ordinary_units,sum(allowance_units)::text founding_allowance_units,sum(locked_units)::text locked_units FROM resource_balances WHERE kingdom_id=ANY($1::uuid[]) GROUP BY resource ORDER BY resource`,
          [kingdomIds],
        )
      ).rows;
    }
    return {
      window: readState(),
      admissionOpen: r.runWindow.isOpen(),
      clock,
      groups,
      counts,
      achievements,
      gameOrigin: config.pactEnv.PACT_ORIGIN,
      fleetOrigin: config.fleetEnv.FLEET_ORIGIN,
    };
  } finally {
    await r.pool.end();
    await game.end();
  }
}
async function snapshot(label) {
  if (!/^[a-z0-9-]{1,64}$/.test(label)) throw Error("Invalid snapshot label");
  const { createCipheriv, randomBytes, createHash } = await import("node:crypto");
  for (const kind of ["pact", "fleet"]) {
    const plain = execFileSync(
      "docker",
      ["exec", config[`${kind}Container`], "pg_dump", "-U", kind, "-d", kind, "-Fc"],
      { maxBuffer: 512 * 1024 * 1024 },
    );
    const key = randomBytes(32),
      nonce = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, nonce);
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    writeFileSync(resolve(root, "keys", `${label}-${kind}.key`), key, { mode: 0o600, flag: "wx" });
    writeFileSync(
      resolve(root, "evidence", `${label}-${kind}.dump.enc`),
      Buffer.concat([nonce, cipher.getAuthTag(), data]),
      { mode: 0o600, flag: "wx" },
    );
    writeFileSync(
      resolve(root, "evidence", `${label}-${kind}.sha256`),
      createHash("sha256").update(plain).digest("hex"),
      { mode: 0o600, flag: "wx" },
    );
  }
}
if (operation === "boot") {
  if (readState().status !== "prepared") throw Error("Boot only while prepared");
  for (const kind of ["pact", "fleet"]) {
    for (let i = 0; i < 60; i++) {
      try {
        execFileSync("docker", ["exec", config[`${kind}Container`], "pg_isready", "-U", kind], { stdio: "pipe" });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
  run("pact", ["packages/db/dist/cli.js"]);
  run("fleet", ["--import", "tsx", "scripts/migrate.ts"]);
  start("pact-api", "pact", ["services/api/dist/main.js"]);
  start("pact-rules", "pact", ["workers/rules/dist/main.js"]);
  start("pact-seals", "pact", ["workers/rules/dist/seal-main.js"]);
  start("pact-notification", "pact", ["workers/notification/dist/main.js"]);
  start("gateway", "pact", ["scripts/local-world/gateway.mjs"], {
    LOCAL_WORLD_WEB_ROOT: resolve(config.pactRepo, "apps/web/dist"),
    LOCAL_WORLD_API_PORT: "3401",
    LOCAL_WORLD_GATEWAY_PORT: "3400",
  });
  await ready(config.pactEnv.PACT_ORIGIN + "/health");
  start("fleet-console", "fleet", ["dist/server/main.js"]);
  await ready(config.fleetEnv.FLEET_ORIGIN + "/health");
  console.log("Local game and console ready; no Fleet worker has been started.");
} else if (operation === "status") {
  console.log(JSON.stringify(await status(), null, 2));
} else if (operation === "snapshot") {
  await snapshot(process.argv[4] ?? "prepared");
  console.log("Prepared encrypted database snapshots saved.");
} else if (operation === "park") {
  if (readState().status !== "prepared") throw Error("Only a not-yet-launched world can be parked");
  run("pact", ["workers/rules/dist/control.js", "pause"]);
  console.log("New local world paused; the observation hour has not begun.");
} else if (operation === "launch") {
  const state = readState();
  if (state.status !== "prepared") throw Error("Run already launched or closed; cannot restart");
  if (!config.sourceRevisions || !config.artifactHashes)
    throw Error("Preparation and artifact verification are incomplete");
  const { createHash } = await import("node:crypto");
  for (const kind of ["pact", "fleet"]) {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: config[`${kind}Repo`], encoding: "utf8" }).trim();
    if (head !== config.sourceRevisions[kind]) throw Error("Prepared source changed; verify before launch");
    execFileSync("git", ["diff", "--quiet", "HEAD"], { cwd: config[`${kind}Repo`] });
  }
  for (const [file, expected] of Object.entries(config.artifactHashes)) {
    if (createHash("sha256").update(readFileSync(file)).digest("hex") !== expected)
      throw Error("Prepared artifact changed");
  }
  execFileSync(config.node, [resolve(config.pactRepo, "scripts/local-world/verify-prepared.mjs"), root], {
    cwd: config.pactRepo,
    stdio: "pipe",
  });
  writeFileSync(resolve(root, "evidence", "start-baseline.json"), JSON.stringify(await status(), null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  const r = await fleet();
  try {
    const groups = (await r.pool.query("SELECT id FROM cohorts ORDER BY name")).rows.map((row) => row.id);
    if (
      groups.length !== 4 ||
      (await r.pool.query("SELECT count(*)::int n FROM agents WHERE credential_state='ready' AND state='ready'"))
        .rows[0].n !== 12
    )
      throw Error("Exactly four complete groups required");
    const { ProfileConsole } = await import(
      pathToFileURL(resolve(config.fleetRepo, "dist/server/platform/profile-console.js")).href
    );
    const profiles = new ProfileConsole(r.store, r.tasks, r.environments, r.engines);
    for (const id of groups) await profiles.prepareStart(id);
    run("pact", ["workers/rules/dist/control.js", "resume"]);
    await r.store.setStates(groups, "running", true, true);
    const anchor = (
      await r.pool.query("SELECT min(anchor_at) anchor,count(DISTINCT anchor_at)::int anchors FROM cohorts")
    ).rows[0];
    if (anchor.anchors !== 1) throw Error("Common anchor required");
    const startsAt = new Date(anchor.anchor).getTime();
    for (const row of (
      await r.pool.query(
        "SELECT a.id,a.next_due_at FROM agents a JOIN cohort_engine_profiles p ON p.cohort_id=a.cohort_id WHERE p.profile_id LIKE 'reactive-%'",
      )
    ).rows) {
      const binding = await r.bindings.forAgent(row.id);
      if (!binding) throw Error("Missing prepared binding");
      const initial = await r.tasks.upsertFromEvent(
        binding,
        {
          id: `initial:${config.id}:${row.id}`,
          type: "periodic_review",
          sourceRef: `initial:${config.id}`,
          observedAt: new Date(startsAt).toISOString(),
          environmentTime: { clockId: "utc", value: new Date(startsAt).toISOString() },
          metadata: {},
        },
        "periodic_review",
      );
      await r.pool.query("UPDATE platform_tasks SET due_at=$2 WHERE id=$1", [initial.id, row.next_due_at]);
      await r.pool.query(
        "INSERT INTO environment_cursors(binding_id,cursor,updated_at,next_review_at) VALUES($1,NULL,$2,$3) ON CONFLICT(binding_id) DO NOTHING",
        [binding.id, new Date(startsAt), new Date(new Date(row.next_due_at).getTime() + 900000)],
      );
    }
    saveState({ ...state, status: "running", startsAt, endsAt: startsAt + 3600000, cohortIds: groups });
    start("observer", "pact", ["scripts/local-world/control.mjs", "watch", root]);
    start("fleet-worker", "fleet", ["dist/server/worker.js"]);
    console.log(
      JSON.stringify({
        status: "running",
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(startsAt + 3600000).toISOString(),
        modelCallQuota: null,
      }),
    );
  } finally {
    await r.pool.end();
  }
} else if (operation === "watch") {
  const { appendFileSync } = await import("node:fs");
  while (readState().status === "running") {
    const state = readState();
    if (Date.now() >= state.endsAt) {
      saveState({ ...state, status: "closed", closedAt: Date.now() });
      run("pact", ["workers/rules/dist/control.js", "pause"]);
      writeFileSync(
        resolve(root, "evidence", "cutoff-observation.json"),
        JSON.stringify({ at: new Date().toISOString(), ...(await status()) }, null, 2),
        { mode: 0o600, flag: "wx" },
      );
      const r = await fleet();
      try {
        for (let i = 0; i < 140; i++) {
          const active = (await r.pool.query("SELECT count(*)::int n FROM turns WHERE state='running'")).rows[0].n;
          if (!active) break;
          await new Promise((ok) => setTimeout(ok, 1000));
        }
        const active = (await r.pool.query("SELECT count(*)::int n FROM turns WHERE state='running'")).rows[0].n;
        if (!active) await r.store.setStates(state.cohortIds, "paused", true);
      } finally {
        await r.pool.end();
      }
      await snapshot("closed");
      appendFileSync(
        resolve(root, "evidence", "observations.ndjson"),
        JSON.stringify({ at: new Date().toISOString(), ...(await status()) }) + "\n",
        { mode: 0o600 },
      );
      break;
    }
    try {
      appendFileSync(
        resolve(root, "evidence", "observations.ndjson"),
        JSON.stringify({ at: new Date().toISOString(), ...(await status()) }) + "\n",
        { mode: 0o600 },
      );
    } catch {
      // A transient read must not prevent the deadline from parking this world.
      appendFileSync(
        resolve(root, "evidence", "observations.ndjson"),
        JSON.stringify({ at: new Date().toISOString(), observationError: true }) + "\n",
        { mode: 0o600 },
      );
    }
    await new Promise((ok) => setTimeout(ok, Math.min(30000, Math.max(1, state.endsAt - Date.now()))));
  }
}
