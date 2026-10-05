import { randomUUID } from "node:crypto";
import { ExposureService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  ActionLimitService,
  ConversationReader,
  ImmediateExposureAdapter,
  SocialOverviewReader,
  SocialService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let ledger: ResourceLedger;
let limits: ActionLimitService;
let social: SocialService;
let now: Date;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "social");
  pool = createSchemaPool(connectionString, schema);
  ledger = new ResourceLedger("pact");
  limits = new ActionLimitService("pact");
  now = new Date("2026-09-23T00:00:00Z");
  social = new SocialService("pact", ledger, limits, { now: () => now });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function kingdom(): Promise<{ accountId: string; kingdomId: string }> {
  const accountId = randomUUID();
  const kingdomId = randomUUID();
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
       VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
      [accountId, `${accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1, 'pact', $2, $3, 'Social Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [kingdomId, accountId, `social_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
  });
  return { accountId, kingdomId };
}

async function credit(kingdomId: string, resource: "iron" | "silver" | "grain", whole: number): Promise<void> {
  await withTransaction(pool, (client) =>
    ledger.creditOrdinary(client, {
      kingdomId,
      resource,
      amount: wholeResources(whole),
      operationKey: `fixture:${randomUUID()}`,
      reason: "fixture",
      gameTimeMs: 0,
    }),
  );
}

async function connect(
  sender: { accountId: string; kingdomId: string },
  recipient: { accountId: string; kingdomId: string },
) {
  const requestId = await withTransaction(pool, (client) =>
    social.requestContact(client, {
      accountId: sender.accountId,
      recipientKingdomId: recipient.kingdomId,
      note: "Hello",
      operationKey: randomUUID(),
      gameTimeMs: 60_000,
    }),
  );
  await withTransaction(pool, (client) =>
    social.answerRequest(client, { accountId: recipient.accountId, requestId, accept: true, gameTimeMs: 120_000 }),
  );
}

describe("contacts, messages, and transfers", () => {
  it("rejects a full cold-request queue before charging a ninth sender", async () => {
    const recipient = await kingdom();
    for (let n = 0; n < 8; n += 1) {
      const sender = await kingdom();
      await credit(sender.kingdomId, "silver", 2);
      await withTransaction(pool, (client) =>
        social.requestContact(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          note: `Hello ${n}`,
          operationKey: randomUUID(),
          gameTimeMs: 60_000,
        }),
      );
    }
    const ninth = await kingdom();
    await credit(ninth.kingdomId, "silver", 2);
    await expect(
      withTransaction(pool, (client) =>
        social.requestContact(client, {
          accountId: ninth.accountId,
          recipientKingdomId: recipient.kingdomId,
          note: "Queue full",
          operationKey: "ninth",
          gameTimeMs: 60_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "CONTACT_QUEUE_FULL" });
    const balance = await withTransaction(pool, (client) => ledger.readBalance(client, ninth.kingdomId, "silver"));
    expect(balance.ordinary).toBe(wholeResources(2));
    expect(
      await withTransaction(pool, (client) => limits.rollingStatus(client, ninth.kingdomId, "cold_contact", 60_000)),
    ).toMatchObject({ used: 0 });
  });

  it("bounds unread text, keeps notifications out of message quota, and blocks both directions", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    await credit(sender.kingdomId, "silver", 2);
    await connect(sender, recipient);
    for (let n = 0; n < 4; n += 1) {
      await withTransaction(pool, (client) =>
        social.sendMessage(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          body: `Message ${n}`,
          agentOriginated: true,
          operationKey: `message-${n}`,
          gameTimeMs: 180_000 + n,
        }),
      );
    }
    await expect(
      withTransaction(pool, (client) =>
        social.sendMessage(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          body: "Fifth",
          agentOriginated: true,
          operationKey: "fifth",
          gameTimeMs: 190_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "MESSAGE_QUEUE_FULL" });
    expect(
      await withTransaction(pool, (client) =>
        limits.rollingStatus(client, sender.kingdomId, "outgoing_message", 190_000),
      ),
    ).toMatchObject({ used: 4 });
    expect(
      await withTransaction(pool, (client) => social.markRead(client, recipient.accountId, sender.kingdomId, 200_000)),
    ).toBe(4);
    const replay = await withTransaction(pool, (client) =>
      social.sendMessage(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        body: "Message 0",
        agentOriginated: true,
        operationKey: "message-0",
        gameTimeMs: 210_000,
      }),
    );
    expect(replay).toBeTruthy();
    expect(
      await withTransaction(pool, (client) =>
        limits.rollingStatus(client, sender.kingdomId, "outgoing_message", 210_000),
      ),
    ).toMatchObject({ used: 4 });
    await withTransaction(pool, (client) =>
      social.setBlock(client, recipient.accountId, sender.kingdomId, true, 220_000),
    );
    await expect(
      withTransaction(pool, (client) =>
        social.sendMessage(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          body: "Blocked",
          agentOriginated: false,
          operationKey: "blocked",
          gameTimeMs: 230_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "BLOCKED" });
    await expect(
      withTransaction(pool, (client) =>
        social.assertDirectCommunicationAllowed(client, recipient.kingdomId, sender.kingdomId),
      ),
    ).rejects.toMatchObject({ code: "BLOCKED" });
    await expect(
      withTransaction(pool, (client) =>
        social.transfer(client, {
          accountId: recipient.accountId,
          recipientKingdomId: sender.kingdomId,
          resource: "grain",
          wholeAmount: 1,
          operationKey: "blocked-gift",
          gameTimeMs: 230_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "BLOCKED" });
  });

  it("acknowledges only actually returned incoming messages and frees the send queue", async () => {
    const sender = await kingdom(),
      recipient = await kingdom(),
      outsider = await kingdom();
    await credit(sender.kingdomId, "silver", 2);
    await connect(sender, recipient);
    const ids: string[] = [];
    for (let n = 0; n < 4; n++)
      ids.push(
        await withTransaction(pool, (client) =>
          social.sendMessage(client, {
            accountId: sender.accountId,
            recipientKingdomId: recipient.kingdomId,
            body: `Read fixture ${n}`,
            agentOriginated: true,
            operationKey: randomUUID(),
            gameTimeMs: 300000 + n,
          }),
        ),
      );
    const reader = new ConversationReader(pool, "pact");
    await reader.read(outsider.accountId, sender.kingdomId, 5);
    await reader.read(sender.accountId, recipient.kingdomId, 5);
    const unread = async () =>
      Number(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM direct_messages WHERE id=ANY($1::uuid[]) AND read_game_time_ms IS NULL",
            [ids],
          )
        ).rows[0].n,
      );
    expect(await unread()).toBe(4);
    const overview = new SocialOverviewReader(pool, "pact");
    await overview.read(recipient.accountId);
    expect(await unread()).toBe(4); // agent guide does not deliver message bodies
    await reader.read(recipient.accountId, sender.kingdomId, 2);
    expect(await unread()).toBe(2);
    await reader.read(recipient.accountId, sender.kingdomId, 2);
    expect(await unread()).toBe(0); // unread-first selection prevents starvation by repeated latest pages
    const next = await withTransaction(pool, (client) =>
      social.sendMessage(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        body: "Next message",
        agentOriginated: true,
        operationKey: randomUUID(),
        gameTimeMs: 400000,
      }),
    );
    ids.push(next);
    expect(await unread()).toBe(1);
    await overview.read(recipient.accountId, { acknowledgeDeliveredMessages: true });
    expect(await unread()).toBe(0);
    const omitted = await withTransaction(pool, (client) =>
      social.sendMessage(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        body: "🦆".repeat(140),
        agentOriginated: true,
        operationKey: randomUUID(),
        gameTimeMs: 500000,
      }),
    );
    ids.push(omitted);
    expect(
      (await reader.read(recipient.accountId, sender.kingdomId, 5))?.messages.find((m) => m.messageId === omitted)
        ?.bodyOmitted,
    ).toBe(true);
    expect(await unread()).toBe(1); // omitted bytes were not read by the agent
    for (let n = 0; n < 3; n++)
      ids.push(
        await withTransaction(pool, (client) =>
          social.sendMessage(client, {
            accountId: sender.accountId,
            recipientKingdomId: recipient.kingdomId,
            body: "\u0001".repeat(200),
            agentOriginated: true,
            operationKey: randomUUID(),
            gameTimeMs: 600000 + n,
          }),
        ),
      );
    const bounded = await reader.read(recipient.accountId, sender.kingdomId, 5);
    expect(Buffer.byteLength(JSON.stringify(bounded), "utf8")).toBeLessThanOrEqual(3600);
    expect(await unread()).toBe(2); // the escaped body omitted by the total page budget stays unread too
    const excerpt = await reader.read(recipient.accountId, sender.kingdomId, 3, 1_000);
    expect(Buffer.byteLength(JSON.stringify(excerpt), "utf8")).toBeLessThanOrEqual(1_000);
    expect(await unread()).toBe(2); // a smaller initial-context budget also preserves omitted messages
  });

  it("uses a one-use direct invitation and commits an ordinary transfer once with overflow", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    const token = await withTransaction(pool, (client) =>
      social.issueDirectInvitation(client, sender.accountId, 60_000),
    );
    await withTransaction(pool, (client) => social.acceptDirectInvitation(client, recipient.accountId, token, 120_000));
    await withTransaction(pool, (client) => social.acceptDirectInvitation(client, recipient.accountId, token, 120_000));
    await credit(sender.kingdomId, "grain", 10);
    const cap = (await withTransaction(pool, (client) => ledger.readBalance(client, recipient.kingdomId, "grain")))
      .storageCap;
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId: recipient.kingdomId,
        resource: "grain",
        amount: cap - wholeResources(1),
        operationKey: "fill-recipient",
        reason: "fixture",
        gameTimeMs: 0,
      }),
    );
    const input = {
      accountId: sender.accountId,
      recipientKingdomId: recipient.kingdomId,
      resource: "grain" as const,
      wholeAmount: 3,
      operationKey: "gift-1",
      gameTimeMs: 180_000,
    };
    const first = await withTransaction(pool, (client) => social.transfer(client, input));
    expect(first).toMatchObject({ credited: wholeResources(1), overflow: wholeResources(2) });
    expect(await withTransaction(pool, (client) => social.transfer(client, input))).toEqual(first);
    const sourceBalance = await withTransaction(pool, (client) =>
      ledger.readBalance(client, sender.kingdomId, "grain"),
    );
    expect(sourceBalance.ordinary).toBe(wholeResources(7));
    expect(
      await withTransaction(pool, (client) => limits.rollingStatus(client, sender.kingdomId, "transfer", 180_000)),
    ).toMatchObject({ used: 1 });
    expect(
      await withTransaction(pool, (client) =>
        limits.rollingStatus(client, sender.kingdomId, "outgoing_message", 180_000),
      ),
    ).toMatchObject({ used: 0 });
  });

  it("expires cold requests on game time and invitation tokens on real time", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    await credit(sender.kingdomId, "silver", 2);
    const requestId = await withTransaction(pool, (client) =>
      social.requestContact(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        note: "Seven-day request",
        operationKey: randomUUID(),
        gameTimeMs: 60_000,
      }),
    );
    expect(
      await withTransaction(pool, (client) => social.expireRequests(client, 60_000 + 7 * 86_400_000)),
    ).toBeGreaterThanOrEqual(1);
    await expect(
      withTransaction(pool, (client) =>
        social.answerRequest(client, {
          accountId: recipient.accountId,
          requestId,
          accept: true,
          gameTimeMs: 60_000 + 7 * 86_400_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
    const token = await withTransaction(pool, (client) =>
      social.issueDirectInvitation(client, sender.accountId, 60_000),
    );
    now = new Date(now.getTime() + 8 * 86_400_000);
    await expect(
      withTransaction(pool, (client) => social.acceptDirectInvitation(client, recipient.accountId, token, 120_000)),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });
  });

  it("rejects an unaffordable transfer without consuming quota or creating a recipient credit", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    const token = await withTransaction(pool, (client) =>
      social.issueDirectInvitation(client, sender.accountId, 60_000),
    );
    await withTransaction(pool, (client) => social.acceptDirectInvitation(client, recipient.accountId, token, 120_000));
    await expect(
      withTransaction(pool, (client) =>
        social.transfer(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          resource: "silver",
          wholeAmount: 1,
          operationKey: "unfunded",
          gameTimeMs: 180_000,
        }),
      ),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(
      await withTransaction(pool, (client) => limits.rollingStatus(client, sender.kingdomId, "transfer", 180_000)),
    ).toMatchObject({ used: 0 });
    expect(
      (await withTransaction(pool, (client) => ledger.readBalance(client, recipient.kingdomId, "silver"))).ordinary,
    ).toBe(0n);
  });

  it("charges agent transfers to the shared immediate authority window atomically", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    await credit(sender.kingdomId, "silver", 5);
    await connect(sender, recipient);
    await pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits)
       VALUES ('pact', $1, ARRAY['transfer'], $2::jsonb)`,
      [sender.accountId, JSON.stringify({ silver: String(wholeResources(3)) })],
    );
    const agentSocial = new SocialService(
      "pact",
      ledger,
      limits,
      { now: () => now },
      new ImmediateExposureAdapter(new ExposureService("pact")),
    );
    await withTransaction(pool, (client) =>
      agentSocial.transfer(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        resource: "silver",
        wholeAmount: 3,
        operationKey: "agent-gift-one",
        actorKind: "agent",
        gameTimeMs: 180_000,
      }),
    );
    await expect(
      withTransaction(pool, (client) =>
        agentSocial.transfer(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          resource: "silver",
          wholeAmount: 1,
          operationKey: "agent-gift-two",
          actorKind: "agent",
          gameTimeMs: 180_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ALLOWANCE" });
    expect(
      (
        await pool.query("SELECT sum(units)::text AS total FROM authority_spends WHERE account_id = $1", [
          sender.accountId,
        ])
      ).rows[0]?.total,
    ).toBe(String(wholeResources(3)));
    expect(
      (await withTransaction(pool, (client) => ledger.readBalance(client, sender.kingdomId, "silver"))).ordinary,
    ).toBe(0n);
  });
});
