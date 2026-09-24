import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendOutbox,
  claimOutboxDelivery,
  createPool,
  createSchemaPool,
  createTestSchema,
  dropTestSchema,
  markOutboxDelivered,
  withTransaction,
} from "@pact/db";
import { ResourceLedger } from "@pact/ledger";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
if (!/test/i.test(new URL(connectionString).pathname))
  throw new Error("Restore rehearsal requires a database name containing 'test'");
const scope = "rules_restore_fixture";
const gameTimeMs = Date.parse("2026-09-24T00:00:00.000Z");
const admin = createPool(connectionString);
let fixturePool;
let fixtureSchema;

function runProgram(program, args, input) {
  const result = spawnSync(program, args, { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} exited ${result.status}: ${result.stderr.slice(0, 2_000)}`);
  return result.stdout;
}

try {
  fixtureSchema = await createTestSchema(admin, "rules_restore");
  fixturePool = createSchemaPool(connectionString, fixtureSchema);
  const ledger = new ResourceLedger(scope);
  const accountId = randomUUID();
  const kingdomId = randomUUID();
  const troopId = randomUUID();
  const commandId = randomUUID();
  const eventId = randomUUID();

  await withTransaction(fixturePool, async (client) => {
    await client.query(
      "INSERT INTO accounts(id, product_scope, email, password_hash) VALUES ($1, $2, 'restore@example.invalid', 'synthetic')",
      [accountId, scope],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1, $2, $3, 'restorefixture', 'Restore Fixture', 'portrait.wolf', now(), $4, 0, $5, $6)`,
      [kingdomId, scope, accountId, gameTimeMs, gameTimeMs + 60_000, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, gameTimeMs);
    await ledger.creditOrdinary(client, {
      kingdomId,
      resource: "iron",
      amount: 12_000n,
      operationKey: "restore-credit",
      reason: "synthetic_import",
      gameTimeMs,
    });
    await client.query(
      `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
         type, placement, created_game_time_ms, created_at)
       VALUES ($1, $2, $3, $3, 'spearman', 'home', $4, now())`,
      [troopId, scope, kingdomId, gameTimeMs],
    );
    await client.query(
      `INSERT INTO command_receipts(product_scope, command_id, canonical_payload_hash, code, receipt)
       VALUES ($1, $2, 'restore-fixture', 'COMMITTED', '{}'::jsonb)`,
      [scope, commandId],
    );
    await appendOutbox(client, { productScope: scope, eventId, type: "restore.fixture.v1", payload: { commandId } });
  });

  const dump = runProgram("pg_dump", ["--no-owner", "--no-privileges", `--schema=${fixtureSchema}`, connectionString]);
  await fixturePool.end();
  fixturePool = undefined;
  await dropTestSchema(admin, fixtureSchema);
  runProgram("psql", ["--set=ON_ERROR_STOP=1", "--single-transaction", connectionString], dump);
  fixturePool = createSchemaPool(connectionString, fixtureSchema);

  const balance = await withTransaction(fixturePool, (client) => ledger.readBalance(client, kingdomId, "iron"));
  const movements = await fixturePool.query(
    `SELECT sum(ordinary_delta)::text AS ordinary, sum(allowance_delta)::text AS allowance
     FROM resource_movements WHERE product_scope = $1 AND kingdom_id = $2 AND resource = 'iron'`,
    [scope, kingdomId],
  );
  assert.equal(balance.ordinary, BigInt(movements.rows[0].ordinary));
  assert.equal(balance.allowance, BigInt(movements.rows[0].allowance));
  assert.equal(balance.ordinary, 12_000n);
  const troops = await fixturePool.query(
    "SELECT id, owner_kingdom_id, host_kingdom_id, placement FROM kingdom_troops WHERE product_scope = $1",
    [scope],
  );
  assert.deepEqual(troops.rows, [
    { id: troopId, owner_kingdom_id: kingdomId, host_kingdom_id: kingdomId, placement: "home" },
  ]);
  assert.equal(
    (
      await fixturePool.query("SELECT 1 FROM command_receipts WHERE product_scope = $1 AND command_id = $2", [
        scope,
        commandId,
      ])
    ).rowCount,
    1,
  );
  await withTransaction(fixturePool, async (client) => {
    const delivery = { consumer: "restore-fixture", eventId, workerId: "replay-worker", leaseMilliseconds: 60_000 };
    assert.equal(await claimOutboxDelivery(client, delivery), true);
    assert.equal(await markOutboxDelivered(client, delivery.consumer, eventId, delivery.workerId), true);
    assert.equal(await claimOutboxDelivery(client, delivery), false);
  });
  process.stdout.write(
    "PASS: restored stock matches movements, unit placement and receipt survive, outbox replay deduplicates.\n",
  );
} finally {
  if (fixturePool) await fixturePool.end();
  if (fixtureSchema) await dropTestSchema(admin, fixtureSchema);
  await admin.end();
}
