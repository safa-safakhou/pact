import { randomUUID } from "node:crypto";
import { CommandDispatcher, DispatcherError } from "@pact/application";
import { type CommandEnvelope, ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const password = "A long test password 123!";
const productScope = ProductScopeSchema.parse("pact");
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let dispatcher: CommandDispatcher;
let secretBox: AesGcmSecretBox;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "dispatcher");
  pool = createSchemaPool(connectionString, schema);
  const clock = { now: () => new Date("2026-09-20T12:00:00.000Z") };
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 7));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.example"]),
    clock,
    digester: new TokenDigester(Buffer.alloc(32, 9)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  dispatcher = new CommandDispatcher({ pool, clock, productScope });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function verifiedAccount(email: string): Promise<string> {
  await identity.signup({
    email,
    password,
    age18Declared: true,
    acceptedTermsVersion: "terms-v1",
  });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    `SELECT payload FROM outbox_events
     WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email'
     ORDER BY id DESC LIMIT 1`,
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("Verification fixture missing");
  const token = Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8");
  await identity.verifyEmail(token);
  return payload.accountId;
}

function command(accountId: string, commandId: string, action: CommandEnvelope["action"]): CommandEnvelope {
  return {
    schemaVersion: "pact.command.v1",
    commandId,
    actor: {
      principalId: accountId,
      productScope,
      audience: "human",
      subject: { type: "account", id: accountId },
    },
    action,
    submittedAt: "2026-09-20T12:00:00.000Z",
  };
}

describe("shared command dispatcher", () => {
  it("commits once for the same id and payload and conflicts on payload reuse", async () => {
    const accountId = await verifiedAccount("dispatcher-one@example.com");
    const principal = { accountId, productScope, audience: "human" as const };
    const commandId = randomUUID();
    const first = await dispatcher.dispatch(
      principal,
      command(accountId, commandId, { kind: "sandbox.draft.write", note: "private draft note" }),
    );
    expect(first.code).toBe("COMMITTED");
    expect(first.committedEventIds).toHaveLength(1);

    const replay = await dispatcher.dispatch(
      principal,
      command(accountId, commandId, { kind: "sandbox.draft.write", note: "private draft note" }),
    );
    expect(replay).toEqual(first);

    const conflict = await dispatcher.dispatch(
      principal,
      command(accountId, commandId, { kind: "sandbox.draft.write", note: "changed payload" }),
    );
    expect(conflict.code).toBe("IDEMPOTENCY_CONFLICT");

    const drafts = await pool.query<{ note: string; version: number }>(
      "SELECT note, version FROM sandbox_drafts WHERE account_id = $1",
      [accountId],
    );
    expect(drafts.rows).toEqual([{ note: "private draft note", version: 1 }]);

    const counters = await dispatcher.dispatch(
      principal,
      command(accountId, randomUUID(), {
        kind: "sandbox.counter.increment",
        counterId: "alpha",
        amount: 2,
      }),
    );
    expect(counters.code).toBe("COMMITTED");
    expect(counters.recordVersions["sandbox.counter:alpha"]).toBe(1);
  });

  it("reconciles a timed-out write via receipt lookup without re-execution or cross-account leakage", async () => {
    const ownerId = await verifiedAccount("dispatcher-owner@example.com");
    const otherId = await verifiedAccount("dispatcher-other@example.com");
    const owner = { accountId: ownerId, productScope, audience: "human" as const };
    const other = { accountId: otherId, productScope, audience: "human" as const };
    const commandId = randomUUID();

    const committed = await dispatcher.dispatch(
      owner,
      command(ownerId, commandId, { kind: "sandbox.counter.increment", counterId: "beta", amount: 3 }),
    );
    expect(committed.code).toBe("COMMITTED");

    const lookedUp = await dispatcher.lookupReceipt(owner, commandId);
    expect(lookedUp).toEqual(committed);

    const stranger = await dispatcher.lookupReceipt(other, commandId);
    expect(stranger).toBeNull();

    await expect(
      dispatcher.dispatch(
        other,
        command(otherId, commandId, { kind: "sandbox.counter.increment", counterId: "beta", amount: 3 }),
      ),
    ).rejects.toBeInstanceOf(DispatcherError);

    const replay = await dispatcher.dispatch(
      owner,
      command(ownerId, commandId, { kind: "sandbox.counter.increment", counterId: "beta", amount: 3 }),
    );
    expect(replay).toEqual(committed);

    const counter = await pool.query<{ value: number }>(
      "SELECT value FROM sandbox_counters WHERE account_id = $1 AND counter_id = $2",
      [ownerId, "beta"],
    );
    expect(counter.rows[0]?.value).toBe(3);
    const otherCounter = await pool.query("SELECT 1 FROM sandbox_counters WHERE account_id = $1 AND counter_id = $2", [
      otherId,
      "beta",
    ]);
    expect(otherCounter.rowCount).toBe(0);
  });
});
