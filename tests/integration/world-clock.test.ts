import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { TICK_PHASES, type TickHandlers, WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "world_clock");
  pool = createSchemaPool(connectionString, schema);
  await pool.query("CREATE TABLE world_test_phase_effects(phase text NOT NULL)");
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function makeDue(scope: string): Promise<void> {
  await pool.query(
    `UPDATE world_clocks SET next_tick_due_at = clock_timestamp() - interval '1 second',
       last_heartbeat_at = clock_timestamp(), lease_expires_at = clock_timestamp() + interval '30 seconds'
     WHERE product_scope = $1`,
    [scope],
  );
}

describe("atomic world clock", () => {
  it("fences a second worker and cannot publish the same minute twice", async () => {
    const world = new WorldClockService(pool, "world_one");
    const initial = await world.bootstrap();
    const firstToken = await world.acquireLease("worker-a");
    expect(firstToken).toBeTruthy();
    expect(await world.acquireLease("worker-b")).toBeNull();
    await makeDue("world_one");
    const first = await world.advance("worker-a", firstToken ?? "");
    expect(first.kind).toBe("committed");
    expect((await world.advance("worker-a", firstToken ?? "")).kind).toBe("not_due");
    expect((await world.advance("worker-b", "wrong-token")).kind).toBe("lease_lost");
    const rows = await pool.query(
      "SELECT tick_sequence, game_time_ms FROM world_ticks WHERE product_scope = 'world_one'",
    );
    expect(rows.rowCount).toBe(1);
    expect((await world.read()).gameTimeMs).toBe(initial.gameTimeMs + 60_000);
    const events = await pool.query(
      "SELECT id FROM outbox_events WHERE product_scope = 'world_one' AND type = 'world.tick.committed.v1'",
    );
    expect(events.rowCount).toBe(1);
  });

  it("rolls back all phases on a crash and resumes at the same due tick", async () => {
    const observed: string[] = [];
    const handlers: TickHandlers = {};
    for (const phase of TICK_PHASES) {
      handlers[phase] = async (client) => {
        observed.push(phase);
        await client.query("INSERT INTO world_test_phase_effects(phase) VALUES ($1)", [phase]);
        if (phase === "upkeep") throw new Error("SIMULATED_CRASH");
      };
    }
    const failing = new WorldClockService(pool, "world_crash", handlers);
    const before = await failing.bootstrap();
    const token = await failing.acquireLease("worker-crash");
    await makeDue("world_crash");
    await expect(failing.advance("worker-crash", token ?? "")).rejects.toThrow("SIMULATED_CRASH");
    expect(observed).toEqual(TICK_PHASES.slice(0, 4));
    expect((await pool.query("SELECT * FROM world_test_phase_effects")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM world_ticks WHERE product_scope = 'world_crash'")).rowCount).toBe(0);
    expect((await failing.read()).gameTimeMs).toBe(before.gameTimeMs);

    const resumed = new WorldClockService(pool, "world_crash", {
      views_and_achievements: async (client) => {
        await client.query("INSERT INTO world_test_phase_effects(phase) VALUES ('published')");
      },
    });
    expect((await resumed.advance("worker-crash", token ?? "")).kind).toBe("committed");
    expect((await pool.query("SELECT * FROM world_test_phase_effects")).rowCount).toBe(1);
    expect((await pool.query("SELECT * FROM world_ticks WHERE product_scope = 'world_crash'")).rowCount).toBe(1);
  });

  it("fences an expired lease before any phase publishes", async () => {
    const world = new WorldClockService(pool, "world_expired");
    await world.bootstrap();
    const oldToken = await world.acquireLease("worker-old");
    await makeDue("world_expired");
    await pool.query(
      "UPDATE world_clocks SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE product_scope = 'world_expired'",
    );
    expect((await world.advance("worker-old", oldToken ?? "")).kind).toBe("lease_lost");
    const newToken = await world.acquireLease("worker-new");
    expect(newToken).toBeTruthy();
    expect((await world.advance("worker-old", oldToken ?? "")).kind).toBe("lease_lost");
    expect((await world.advance("worker-new", newToken ?? "")).kind).toBe("committed");
  });

  it("does not publish a tick when its lease expires during a phase", async () => {
    const world = new WorldClockService(pool, "world_slow_phase", {
      production: async (client) => {
        await client.query("SELECT pg_sleep(0.6)");
        await client.query("INSERT INTO world_test_phase_effects(phase) VALUES ('slow')");
      },
    });
    await world.bootstrap();
    const token = await world.acquireLease("worker-slow");
    await makeDue("world_slow_phase");
    await pool.query(
      "UPDATE world_clocks SET lease_expires_at = clock_timestamp() + interval '500 milliseconds' WHERE product_scope = 'world_slow_phase'",
    );
    await expect(world.advance("worker-slow", token ?? "")).rejects.toThrow("WORLD_LEASE_EXPIRED_DURING_TICK");
    expect((await pool.query("SELECT * FROM world_ticks WHERE product_scope = 'world_slow_phase'")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM world_test_phase_effects WHERE phase = 'slow'")).rowCount).toBe(0);
  });

  it("admits commands against a committed tick, then freezes every game window on outage", async () => {
    const settledGameTimes: number[] = [];
    const world = new WorldClockService(pool, "world_pause", {
      production: async (_client, context) => {
        settledGameTimes.push(context.gameTimeMs);
      },
      upkeep: async (_client, context) => {
        settledGameTimes.push(context.gameTimeMs);
      },
    });
    const before = await world.bootstrap();
    const admitted = await world.admitCommand(async (_client, committed) => committed.sequence);
    expect(admitted).toEqual({ kind: "admitted", value: 0n, committed: before });
    await pool.query(
      "UPDATE world_clocks SET last_heartbeat_at = clock_timestamp() - interval '61 seconds' WHERE product_scope = 'world_pause'",
    );
    expect(await world.acquireLease("worker-late")).toBeNull();
    expect((await world.read()).status).toBe("paused");
    expect(await world.admitCommand(async () => "wrong")).toEqual({ kind: "paused" });
    expect((await world.read()).gameTimeMs).toBe(before.gameTimeMs);
    expect(settledGameTimes).toEqual([]);
    const account = await pool.query<{ id: string }>(
      "INSERT INTO accounts(product_scope, email, password_hash) VALUES ('world_pause', 'clock@example.invalid', 'synthetic') RETURNING id",
    );
    await pool.query(
      `INSERT INTO sessions(product_scope, account_id, audience, token_hash, expires_at, idle_expires_at)
       VALUES ('world_pause', $1, 'human', 'synthetic-world-clock-token',
         clock_timestamp() - interval '1 second', clock_timestamp() - interval '1 second')`,
      [account.rows[0]?.id],
    );
    const expired = await pool.query<{ expired: boolean }>(
      `SELECT expires_at <= clock_timestamp() AS expired FROM sessions
       WHERE token_hash = 'synthetic-world-clock-token'`,
    );
    expect(expired.rows[0]?.expired).toBe(true);
    const resumed = await world.resume();
    expect(resumed.status).toBe("active");
    expect(resumed.gameTimeMs).toBe(before.gameTimeMs);
    expect(resumed.nextTickDueAt.getTime()).toBeGreaterThan(Date.now());
    const token = await world.acquireLease("worker-recovered");
    await makeDue("world_pause");
    expect((await world.advance("worker-recovered", token ?? "")).kind).toBe("committed");
    expect(settledGameTimes).toEqual([before.gameTimeMs + 60_000, before.gameTimeMs + 60_000]);
  });

  it("serializes command admission before tick publication", async () => {
    const world = new WorldClockService(pool, "world_serialized");
    await world.bootstrap();
    const token = await world.acquireLease("worker-serialized");
    await pool.query(
      `UPDATE world_clocks SET next_tick_due_at = clock_timestamp() + interval '100 milliseconds'
       WHERE product_scope = 'world_serialized'`,
    );
    let releaseCommand: (() => void) | undefined;
    let commandEntered: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      releaseCommand = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      commandEntered = resolve;
    });
    const command = world.admitCommand(async (_client, committed) => {
      commandEntered?.();
      await held;
      return committed.sequence;
    });
    await entered;
    await new Promise((resolve) => setTimeout(resolve, 120));
    let published = false;
    const tick = world.advance("worker-serialized", token ?? "").then((value) => {
      published = true;
      return value;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(published).toBe(false);
    releaseCommand?.();
    expect((await command).kind).toBe("admitted");
    expect((await tick).kind).toBe("committed");
    const after = await world.admitCommand(async (_client, committed) => committed.sequence);
    expect(after).toMatchObject({ kind: "admitted", value: 1n });
  });

  it("holds an exact-boundary command until the due tick commits", async () => {
    const world = new WorldClockService(pool, "world_boundary");
    await world.bootstrap();
    const token = await world.acquireLease("worker-boundary");
    await makeDue("world_boundary");
    expect(await world.admitCommand(async () => "must-not-run")).toEqual({ kind: "tick_pending" });
    expect((await world.advance("worker-boundary", token ?? "")).kind).toBe("committed");
    const admitted = await world.admitCommand(async (_client, committed) => committed.sequence);
    expect(admitted).toMatchObject({ kind: "admitted", value: 1n });
  });
});
