import { randomUUID } from "node:crypto";
import { appendOutbox, withTransaction } from "@pact/db";
import { RULES_ID } from "@pact/domain";
import type { Pool, PoolClient } from "pg";
import { GAME_MINUTE_MS, TICK_PHASES, type TickPhase } from "./clock.js";

const MAX_HEARTBEAT_GAP_MS = 60_000;
const DEFAULT_LEASE_MS = 30_000;

interface ClockRow {
  product_scope: string;
  rules_id: string;
  status: "active" | "paused";
  committed_game_time_ms: string;
  tick_sequence: string;
  next_tick_due_at: Date;
  last_heartbeat_at: Date;
  lease_holder: string | null;
  lease_token: string | null;
  lease_expires_at: Date | null;
  suspension_reason: string | null;
  pause_origin: string;
  recovery_checks: number;
  paused_at: Date | null;
}

export interface TickContext {
  productScope: string;
  sequence: bigint;
  gameTimeMs: number;
  dueAt: Date;
}

export type TickHandler = (client: PoolClient, context: TickContext) => Promise<void>;
export type TickHandlers = Partial<Record<TickPhase, TickHandler>>;

export type TickResult = { kind: "committed"; context: TickContext } | { kind: "not_due" | "lease_lost" | "paused" };

export interface WorldSnapshot {
  status: "active" | "paused";
  gameTimeMs: number;
  sequence: bigint;
  nextTickDueAt: Date;
  suspensionReason: string | null;
}

function gameTime(row: ClockRow): number {
  const value = Number(row.committed_game_time_ms);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("UNSAFE_GAME_TIME");
  return value;
}

function snapshot(row: ClockRow): WorldSnapshot {
  return {
    status: row.status,
    gameTimeMs: gameTime(row),
    sequence: BigInt(row.tick_sequence),
    nextTickDueAt: row.next_tick_due_at,
    suspensionReason: row.suspension_reason,
  };
}

async function databaseNow(client: PoolClient): Promise<Date> {
  const result = await client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
  const now = result.rows[0]?.now;
  if (!now) throw new Error("DATABASE_CLOCK_UNAVAILABLE");
  return now;
}

async function lockedClock(client: PoolClient, productScope: string): Promise<ClockRow> {
  const result = await client.query<ClockRow>("SELECT * FROM world_clocks WHERE product_scope = $1 FOR UPDATE", [
    productScope,
  ]);
  const row = result.rows[0];
  if (!row) throw new Error("WORLD_NOT_BOOTSTRAPPED");
  if (row.rules_id !== RULES_ID) throw new Error("WORLD_RULES_VERSION_MISMATCH");
  return row;
}

async function suspend(
  client: PoolClient,
  productScope: string,
  reason: string,
  now: Date,
  origin = "operational",
): Promise<void> {
  await client.query(
    `UPDATE world_clocks SET status = 'paused', paused_at = $2, suspension_reason = $3,
       lease_holder = NULL, lease_token = NULL, lease_expires_at = NULL,pause_origin=$4,recovery_checks=0
     WHERE product_scope = $1`,
    [productScope, now, reason, origin],
  );
}

function tooLate(row: ClockRow, now: Date): string | null {
  if (now.getTime() - row.last_heartbeat_at.getTime() > MAX_HEARTBEAT_GAP_MS) return "HEARTBEAT_DELAYED";
  if (now.getTime() - row.next_tick_due_at.getTime() >= GAME_MINUTE_MS) return "TICK_DELAYED";
  return null;
}

export class WorldClockService {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
    private readonly handlers: TickHandlers = {},
  ) {}

  async bootstrap(): Promise<WorldSnapshot> {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `WITH instant AS (SELECT clock_timestamp() AS real_now)
         INSERT INTO world_clocks(product_scope, rules_id, status, committed_game_time_ms,
          next_tick_due_at, last_heartbeat_at)
         SELECT $1, $2, 'active',
           (extract(epoch FROM date_trunc('minute', real_now)) * 1000)::bigint,
           date_trunc('minute', real_now) + interval '1 minute', real_now FROM instant
         ON CONFLICT(product_scope) DO NOTHING`,
        [this.productScope, RULES_ID],
      );
      return snapshot(await lockedClock(client, this.productScope));
    });
  }

  async read(client: PoolClient | Pool = this.pool): Promise<WorldSnapshot> {
    const result = await client.query<ClockRow>("SELECT * FROM world_clocks WHERE product_scope = $1", [
      this.productScope,
    ]);
    const row = result.rows[0];
    if (!row) throw new Error("WORLD_NOT_BOOTSTRAPPED");
    if (row.rules_id !== RULES_ID) throw new Error("WORLD_RULES_VERSION_MISMATCH");
    return snapshot(row);
  }

  async acquireLease(workerId: string, leaseMs = DEFAULT_LEASE_MS): Promise<string | null> {
    if (!workerId || !Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new Error("INVALID_LEASE");
    return withTransaction(this.pool, async (client) => {
      const row = await lockedClock(client, this.productScope);
      const now = await databaseNow(client);
      if (row.status === "paused") return null;
      const reason = tooLate(row, now);
      if (reason) {
        await suspend(client, this.productScope, reason, now);
        return null;
      }
      if (row.lease_expires_at && row.lease_expires_at > now && row.lease_holder !== workerId) return null;
      const token = randomUUID();
      await client.query(
        `UPDATE world_clocks SET lease_holder = $2, lease_token = $3,
           lease_expires_at = $4, last_heartbeat_at = $5 WHERE product_scope = $1`,
        [this.productScope, workerId, token, new Date(now.getTime() + leaseMs), now],
      );
      return token;
    });
  }

  async heartbeat(workerId: string, token: string, leaseMs = DEFAULT_LEASE_MS): Promise<boolean> {
    if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new Error("INVALID_LEASE");
    return withTransaction(this.pool, async (client) => {
      const row = await lockedClock(client, this.productScope);
      const now = await databaseNow(client);
      if (row.status !== "active" || row.lease_holder !== workerId || row.lease_token !== token) return false;
      const reason = tooLate(row, now);
      if (reason) {
        await suspend(client, this.productScope, reason, now);
        return false;
      }
      if (!row.lease_expires_at || row.lease_expires_at <= now) return false;
      await client.query(
        `UPDATE world_clocks SET lease_expires_at = $2, last_heartbeat_at = $3 WHERE product_scope = $1`,
        [this.productScope, new Date(now.getTime() + leaseMs), now],
      );
      return true;
    });
  }

  async advance(workerId: string, token: string): Promise<TickResult> {
    return withTransaction(this.pool, async (client) => {
      const row = await lockedClock(client, this.productScope);
      const now = await databaseNow(client);
      if (row.status !== "active") return { kind: "paused" };
      const reason = tooLate(row, now);
      if (reason) {
        await suspend(client, this.productScope, reason, now);
        return { kind: "paused" };
      }
      if (
        row.lease_holder !== workerId ||
        row.lease_token !== token ||
        !row.lease_expires_at ||
        row.lease_expires_at <= now
      ) {
        return { kind: "lease_lost" };
      }
      if (row.next_tick_due_at > now) return { kind: "not_due" };
      const context: TickContext = {
        productScope: this.productScope,
        sequence: BigInt(row.tick_sequence) + 1n,
        gameTimeMs: gameTime(row) + GAME_MINUTE_MS,
        dueAt: row.next_tick_due_at,
      };
      if (!Number.isSafeInteger(context.gameTimeMs)) throw new Error("UNSAFE_GAME_TIME");
      for (const phase of TICK_PHASES) await this.handlers[phase]?.(client, context);
      const publishedAt = await databaseNow(client);
      if (row.lease_expires_at <= publishedAt) throw new Error("WORLD_LEASE_EXPIRED_DURING_TICK");
      if (publishedAt.getTime() - context.dueAt.getTime() >= GAME_MINUTE_MS) {
        throw new Error("WORLD_TICK_EXPIRED_DURING_PHASES");
      }
      await client.query(
        `INSERT INTO world_ticks(product_scope, tick_sequence, game_time_ms, due_at, rules_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [this.productScope, context.sequence.toString(), context.gameTimeMs, context.dueAt, RULES_ID],
      );
      await appendOutbox(client, {
        productScope: this.productScope,
        eventId: randomUUID(),
        type: "world.tick.committed.v1",
        payload: { sequence: context.sequence.toString(), gameTimeMs: String(context.gameTimeMs), rulesId: RULES_ID },
      });
      await client.query(
        `UPDATE world_clocks SET committed_game_time_ms = $2, tick_sequence = $3,
           next_tick_due_at = $4, last_heartbeat_at = $5 WHERE product_scope = $1`,
        [
          this.productScope,
          context.gameTimeMs,
          context.sequence.toString(),
          new Date(context.dueAt.getTime() + GAME_MINUTE_MS),
          publishedAt,
        ],
      );
      return { kind: "committed", context };
    });
  }

  async admitCommand<T>(
    operation: (client: PoolClient, committed: WorldSnapshot) => Promise<T>,
  ): Promise<{ kind: "admitted"; value: T; committed: WorldSnapshot } | { kind: "paused" | "tick_pending" }> {
    return withTransaction(this.pool, async (client) => {
      const row = await lockedClock(client, this.productScope);
      const now = await databaseNow(client);
      if (row.status === "paused") return { kind: "paused" };
      const reason = tooLate(row, now);
      if (reason) {
        await suspend(client, this.productScope, reason, now);
        return { kind: "paused" };
      }
      if (row.next_tick_due_at <= now) return { kind: "tick_pending" };
      const committed = snapshot(row);
      const value = await operation(client, committed);
      return { kind: "admitted", value, committed };
    });
  }

  async pause(reason = "OPERATOR_PAUSE"): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      await lockedClock(client, this.productScope);
      await suspend(client, this.productScope, reason, await databaseNow(client), "operator");
    });
  }

  /** Only future, explicitly operational pauses; never clears a manual/legacy pause. */
  async recoverOperationalPause(): Promise<boolean> {
    return withTransaction(this.pool, async (client) => {
      const row = await lockedClock(client, this.productScope),
        now = await databaseNow(client);
      if (
        row.status !== "paused" ||
        row.pause_origin !== "operational" ||
        !["HEARTBEAT_DELAYED", "TICK_DELAYED"].includes(row.suspension_reason ?? "")
      )
        return false;
      const latest = (
        await client.query<{ n: string; time: string | null }>(
          "SELECT coalesce(max(tick_sequence),0)::text n,max(game_time_ms)::text time FROM world_ticks WHERE product_scope=$1",
          [this.productScope],
        )
      ).rows[0];
      if (
        !latest ||
        BigInt(latest.n) !== BigInt(row.tick_sequence) ||
        (latest.time !== null && Number(latest.time) !== gameTime(row))
      )
        throw new Error("WORLD_RECOVERY_INCONSISTENT");
      await client.query("UPDATE world_clocks SET recovery_checks=recovery_checks+1 WHERE product_scope=$1", [
        this.productScope,
      ]);
      if (row.recovery_checks < 2 || !row.paused_at || now.getTime() - row.paused_at.getTime() < 5000) return false;
      await client.query(
        `UPDATE world_clocks SET status='active',paused_at=NULL,suspension_reason=NULL,recovery_checks=0,
        next_tick_due_at=$2,last_heartbeat_at=$3,lease_holder=NULL,lease_token=NULL,lease_expires_at=NULL WHERE product_scope=$1`,
        [this.productScope, new Date(now.getTime() + GAME_MINUTE_MS), now],
      );
      await appendOutbox(client, {
        productScope: this.productScope,
        eventId: randomUUID(),
        type: "world.clock.recovered.v1",
        payload: {
          reason: row.suspension_reason,
          sequence: row.tick_sequence,
          gameTimeMs: row.committed_game_time_ms,
          policy: "operational-recovery-v1",
        },
      });
      return true;
    });
  }
  async resume(): Promise<WorldSnapshot> {
    return withTransaction(this.pool, async (client) => {
      const row = await lockedClock(client, this.productScope);
      if (row.status === "active") return snapshot(row);
      const now = await databaseNow(client);
      const result = await client.query<ClockRow>(
        `UPDATE world_clocks SET status = 'active', paused_at = NULL, suspension_reason = NULL,
           next_tick_due_at = $2, last_heartbeat_at = $3,
           lease_holder = NULL, lease_token = NULL, lease_expires_at = NULL
         WHERE product_scope = $1 RETURNING *`,
        [this.productScope, new Date(now.getTime() + GAME_MINUTE_MS), now],
      );
      const resumed = result.rows[0];
      if (!resumed) throw new Error("WORLD_NOT_BOOTSTRAPPED");
      return snapshot(resumed);
    });
  }
}
